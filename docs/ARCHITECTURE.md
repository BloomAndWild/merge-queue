# Merge Queue Architecture

## Overview

The merge queue is a TypeScript-based GitHub Actions utility that automatically validates and merges approved PRs sequentially. It follows a standalone utility pattern where the merge-queue repository provides reusable GitHub Actions that any repository can reference.

## Core Principles

### 1. Sequential Processing
- Process one PR at a time to ensure each is tested against the latest master
- Prevents merge conflicts and test failures due to concurrent merges
- Guarantees that each PR is validated against the most recent codebase state

### 2. Trust & Auto-Update
- Trust existing PR tests rather than creating separate test branches
- Automatically update PR branches when they fall behind master
- GitHub automatically re-runs tests after branch updates
- Simpler and more reliable than test branch approaches

### 3. Multi-Repository Support
- Each repository gets its own independent queue
- Zero configuration needed when adding new repositories
- Self-service model - no changes to merge-queue repo required

### 4. Label-Based State
- Queue membership tracked via GitHub labels — no external state files
- `queued-for-merge` label = PR is in the queue
- `merge-processing` label = PR is currently being processed
- Queue order determined by PR creation date (oldest first)
- Inherently concurrency-safe — no read-modify-write races

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Target Repository                         │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │
│  │ queue-entry.yml│  │queue-manager   │  │queue-remove   │ │
│  │  (on: labeled) │  │(workflow_run)  │  │(on: unlabeled)│ │
│  └────────┬───────┘  └───────┬────────┘  └───────┬───────┘ │
│           │                  │                    │          │
└───────────┼──────────────────┼────────────────────┼──────────┘
            │                  │                    │
            ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                  Merge Queue Repository                      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ add-to-queue │  │process-queue │  │ remove-from-queue│  │
│  │    action    │  │    action    │  │     action       │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │             │
│         └─────────────────┼────────────────────┘             │
│                           │                                  │
│              ┌────────────▼───────────┐                      │
│              │   Core Modules         │                      │
│              │                        │                      │
│              │  ┌──────────────────┐  │                      │
│              │  │   GitHubAPI      │  │                      │
│              │  │ (API + Labels)   │  │                      │
│              │  └──────────────────┘  │                      │
│              │  ┌──────────────────┐  │                      │
│              │  │  PRValidator     │  │                      │
│              │  │  (Validation)    │  │                      │
│              │  └──────────────────┘  │                      │
│              │  ┌──────────────────┐  │                      │
│              │  │ BranchUpdater    │  │                      │
│              │  │ (Auto-update)    │  │                      │
│              │  └──────────────────┘  │                      │
│              │  ┌──────────────────┐  │                      │
│              │  │   PRMerger       │  │                      │
│              │  │ (Merge Logic)    │  │                      │
│              │  └──────────────────┘  │                      │
│              └────────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Adding a PR to Queue

```
1. User adds "ready" label to PR
2. queue-entry.yml workflow triggered
3. add-to-queue action called
4. PRValidator validates PR:
   - All checks passing?
   - Not in draft state?
   - No blocking labels?
   - No merge conflicts?
5. If valid:
   - Add "queued-for-merge" label
   - Post comment confirming addition
6. If invalid:
   - Add "merge-queue-failed" label
   - Post comment with failure reason
```

### Processing the Queue

```
1. queue-manager.yml runs (after entry/remove + self-dispatch)
2. process-queue action called
3. Search for PRs with "merge-processing" label (resume after crash)
4. If none, search for PRs with "queued-for-merge" label (oldest first)
5. If no PR, exit
6. Add "merge-processing" label, remove "queued-for-merge"
7. PRValidator.validate() → Re-validate PR
8. If validation fails:
   - Remove processing label, add failure label
   - Post comment
9. If valid but behind master:
   - BranchUpdater.updateIfBehind()
   - Merge master into PR branch
   - Wait for tests to complete
   - If tests fail: remove from queue
10. If all checks pass:
    - Merge PR
    - Delete branch (if configured)
    - Remove processing label
    - Post success comment
11. Self-dispatch to process next PR
```

### Removing from Queue

```
1. User removes "ready" label OR closes PR
2. queue-remove.yml workflow triggered
3. remove-from-queue action called
4. Remove queue-related labels (queued-for-merge, merge-processing, merge-updating)
```

## State Management

Queue state is tracked entirely through GitHub labels on the target repository's
pull requests. There are no state files or state branches.

| Label | Meaning |
|-------|---------|
| `queued-for-merge` | PR is waiting in the queue |
| `merge-processing` | PR is currently being processed |
| `merge-updating` | PR branch is being updated with master |

### Queue Order

PRs are processed in **creation date order** (oldest first). The `process-queue`
action calls `GitHubAPI.listPRsWithLabel('queued-for-merge')` which uses the
GitHub Issues API sorted by `created` ascending.

### Concurrency

The add-to-queue and remove-from-queue workflows have **no concurrency groups**.
Multiple PRs can be labeled "ready" simultaneously — each workflow run
independently adds or removes labels without conflicting.

The process-queue workflow uses a concurrency group (`merge-queue-processor`)
because only one PR should be processed at a time by design.

If a `merge-processing` label is found when process-queue starts, it means a
previous run was interrupted. The action resumes by re-processing that PR.

## Security Model

### Authentication

- Uses Personal Access Token (PAT) or GitHub App
- Stored as `MERGE_QUEUE_TOKEN` secret in target repositories
- Requires access to the target repository for reading PRs, writing comments/labels, and merging

### Permissions Required

```yaml
permissions:
  contents: write      # Merge PRs
  pull-requests: write # Comment, label, merge PRs
  actions: read        # Check workflow status
  checks: read         # Validate PR checks
```

### Validation

- All inputs validated and sanitized
- PR approvals enforced via GitHub branch protection
- No bypass of approval requirements possible

## Error Handling

### Failure Categories

1. **Validation Failures** (PR doesn't meet requirements)
   - Remove from queue
   - Add failure label
   - Comment with details

2. **Merge Conflicts** (During branch update)
   - Remove from queue
   - Add conflict label
   - Request manual resolution

3. **Test Failures** (After branch update)
   - Remove from queue
   - Add failure label
   - Can be re-queued after fixes

4. **Transient Errors** (API failures, network issues)
   - Retry with exponential backoff
   - Up to 3 attempts
   - If still failing, treat as validation failure

5. **Timeouts** (Tests don't complete)
   - Configurable timeout (default 30 min)
   - Remove from queue with error details

### Recovery Mechanisms

- Graceful handling of deleted/closed PRs
- Stale `merge-processing` label detected and resumed on next run
- Idempotent label operations (removing a missing label is a no-op)

## Scalability Considerations

### Performance

- Sequential processing limits throughput
- Target: ~2-3 PRs per hour per repository
- Independent queues scale linearly with repos

### Resource Usage

- Minimal CPU/memory (TypeScript + Node.js)
- GitHub Actions free tier sufficient for most teams
- No external services required

### Future Optimizations

- Priority via labels (e.g. `priority-high`)
- Batch merging (merge compatible PRs together)
- Predictive branch updates (update before PR's turn)

## Extension Points

### Custom Validation Logic

Extend `PRValidator` to add custom validation rules:

```typescript
class CustomValidator extends PRValidator {
  async validate(prNumber: number): Promise<ValidationResult> {
    const baseResult = await super.validate(prNumber);
    // Add custom logic
    return baseResult;
  }
}
```

### Custom Merge Strategies

Extend `PRMerger` for custom merge behavior:

```typescript
class CustomMerger extends PRMerger {
  async merge(prNumber: number): Promise<MergeResultDetails> {
    // Custom pre-merge logic
    const result = await super.merge(prNumber);
    // Custom post-merge logic
    return result;
  }
}
```

### Notifications

Add notification hooks in actions:

```typescript
// In process-queue action
if (result === 'merged') {
  await sendSlackNotification(prNumber);
}
```

## Testing Strategy

### Unit Tests

- Test individual modules in isolation
- Mock external dependencies (GitHub API)
- Focus on business logic and edge cases

### Integration Tests

- Test with real GitHub repositories
- Validate end-to-end workflows
- Test cross-repo interactions

### Manual Testing Checklist

See [../claude-plan.md](../claude-plan.md) for comprehensive checklist

## Deployment

### Initial Setup

1. Create merge-queue repository on GitHub
2. Push code and tag release (v1.0.0)

### Adding to Target Repository

1. Copy 3 workflow files to `.github/workflows/`
2. Configure `MERGE_QUEUE_TOKEN` secret
3. Create required labels
4. Customize workflow inputs (optional)
5. Add "ready" label to PR to test

### Updating

1. Update merge-queue repository code
2. Tag new release (v1.1.0)
3. Update action references in target repos:
   ```yaml
   uses: org/merge-queue@v1.1.0/src/actions/add-to-queue
   ```

## Monitoring

### Available Data

- GitHub Actions logs for detailed debugging
- PR comments provide audit trail
- Search for PRs with queue labels to see current queue state

### Alerts

- Long queue wait times (>1 hour)
- High failure rates (>20%)

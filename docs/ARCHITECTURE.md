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
- State files are automatically created based on repository name
- Zero configuration needed when adding new repositories
- Self-service model - no changes to merge-queue repo required

### 4. Git-Based State Management
- Queue state stored as JSON files in `merge-queue-state` branch
- Atomic updates with conflict detection
- Versioned and auditable
- No external dependencies required

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Target Repository                         │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │
│  │ queue-entry.yml│  │queue-manager   │  │queue-remove   │ │
│  │  (on: labeled) │  │  (on: schedule)│  │  (on: labeled)│ │
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
│              │  │ QueueStateManager│  │                      │
│              │  │  (State CRUD)    │  │                      │
│              │  └──────────────────┘  │                      │
│              │  ┌──────────────────┐  │                      │
│              │  │   GitHubAPI      │  │                      │
│              │  │ (API Wrapper)    │  │                      │
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
│                           │                                  │
│              ┌────────────▼───────────┐                      │
│              │  merge-queue-state     │                      │
│              │       branch           │                      │
│              │                        │                      │
│              │  owner1-repo1-queue.json                      │
│              │  owner1-repo2-queue.json                      │
│              │  owner2-repo3-queue.json                      │
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
   - Has required approvals?
   - All checks passing?
   - Not in draft state?
   - No blocking labels?
   - No merge conflicts?
5. If valid:
   - Add to queue state
   - Add "queued-for-merge" label
   - Post comment with queue position
6. If invalid:
   - Add "merge-queue-failed" label
   - Post comment with failure reason
```

### Processing the Queue

```
1. queue-manager.yml runs (every 5 min + on push to master)
2. process-queue action called
3. QueueStateManager.getNextPR() → Get first PR in queue
4. If no PR, exit
5. Set PR as current in state
6. PRValidator.validate() → Re-validate PR
7. If validation fails:
   - Remove from queue
   - Add failure label
   - Post comment
   - Move to next PR
8. If valid but behind master:
   - BranchUpdater.updateIfBehind()
   - Merge master into PR branch
   - Wait for tests to complete
   - If tests fail: Remove from queue
9. If all checks pass:
   - PRMerger.merge() → Merge PR
   - Delete branch (if configured)
   - Update state with success
   - Post success comment
10. Process next PR in queue
```

### Removing from Queue

```
1. User removes "ready" label OR closes PR
2. queue-remove.yml workflow triggered
3. remove-from-queue action called
4. Remove PR from queue state
5. Remove queue-related labels
```

## State Management

### State File Structure

Each repository has its own state file in the `merge-queue-state` branch:

**File name pattern:** `{owner}-{repo}-queue.json`

**Example:** `bloomandwild-bloomandwild-queue.json`

```json
{
  "version": "1.0.0",
  "updated_at": "2024-01-15T10:30:00Z",
  "current": {
    "pr_number": 123,
    "status": "merging",
    "started_at": "2024-01-15T10:25:00Z",
    "updated_at": "2024-01-15T10:28:00Z"
  },
  "queue": [
    {
      "pr_number": 124,
      "added_at": "2024-01-15T10:20:00Z",
      "added_by": "alice",
      "sha": "abc123",
      "priority": 0
    }
  ],
  "history": [
    {
      "pr_number": 122,
      "result": "merged",
      "completed_at": "2024-01-15T10:24:00Z",
      "duration_seconds": 180
    }
  ],
  "stats": {
    "total_processed": 42,
    "total_merged": 38,
    "total_failed": 4
  }
}
```

### Concurrency Control

- GitHub Actions concurrency groups prevent parallel processing
- State updates use atomic operations with conflict detection
- Retry logic with exponential backoff for transient failures
- Force-with-lease git operations prevent state corruption

## Security Model

### Authentication

- Uses Personal Access Token (PAT) or GitHub App
- Stored as `MERGE_QUEUE_TOKEN` secret in target repositories
- Requires cross-repo access:
  - Target repo: Read PRs, write comments/labels, merge
  - Merge-queue repo: Read/write to state branch

### Permissions Required

```yaml
permissions:
  contents: write      # Update state branch, merge PRs
  pull-requests: write # Comment, label, merge PRs
  actions: read        # Check workflow status
  checks: read         # Validate PR checks
```

### Validation

- All inputs validated and sanitized
- PR approvals verified before merge
- State structure validated on read/write
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

- State validation on every read
- Automatic state file creation for new repos
- Graceful handling of deleted/closed PRs
- Idempotent operations (can safely retry)

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

- Parallel testing (test multiple PRs simultaneously)
- Priority queues (high/normal/low priority)
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
3. Initialize `merge-queue-state` branch

### Adding to Target Repository

1. Copy 3 workflow files to `.github/workflows/`
2. Configure `MERGE_QUEUE_TOKEN` secret
3. Customize workflow inputs (optional)
4. Add "ready" label to PR to test

### Updating

1. Update merge-queue repository code
2. Tag new release (v1.1.0)
3. Update action references in target repos:
   ```yaml
   uses: org/merge-queue@v1.1.0/src/actions/add-to-queue
   ```

## Monitoring

### Metrics to Track

- Average queue wait time
- Merge success rate
- Failure reasons distribution
- Queue length over time

### Available Data

- State files contain history and stats
- GitHub Actions logs for detailed debugging
- PR comments provide audit trail

### Alerts

- Long queue wait times (>1 hour)
- High failure rates (>20%)
- State corruption (validation errors)

# Quick Start Guide

Get your merge queue up and running in 15 minutes.

## Prerequisites

- GitHub repository with admin access
- Node.js 20.x installed

## 5-Minute Setup

### 1. Create PAT (2 minutes)

1. Go to https://github.com/settings/tokens
2. Generate new token (classic)
3. Check `repo` and `workflow` scopes
4. Copy token

### 2. Add Secret (1 minute)

In your repository:
1. Settings → Secrets → New secret
2. Name: `MERGE_QUEUE_TOKEN`
3. Value: [paste token]

### 3. Add Workflows (5 minutes)

Create `.github/workflows/` directory and add three files:

**merge-queue-entry.yml**:
```yaml
name: Merge Queue Entry
on:
  pull_request:
    types: [labeled]

jobs:
  add-to-queue:
    if: github.event.label.name == 'ready'
    runs-on: ubuntu-latest
    steps:
      - uses: YOUR-ORG/merge-queue@v1/src/actions/add-to-queue
        with:
          github-token: ${{ secrets.MERGE_QUEUE_TOKEN }}
```

**merge-queue-manager.yml**:
```yaml
name: Merge Queue Manager
on:
  schedule:
    - cron: '*/5 * * * *'
  push:
    branches: [main]

concurrency:
  group: merge-queue-processor
  cancel-in-progress: false

jobs:
  process-queue:
    runs-on: ubuntu-latest
    steps:
      - uses: YOUR-ORG/merge-queue@v1/src/actions/process-queue
        with:
          github-token: ${{ secrets.MERGE_QUEUE_TOKEN }}
```

**merge-queue-remove.yml**:
```yaml
name: Merge Queue Remove
on:
  pull_request:
    types: [unlabeled, closed]

jobs:
  remove-from-queue:
    if: |
      (github.event.action == 'unlabeled' && github.event.label.name == 'ready') ||
      github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: YOUR-ORG/merge-queue@v1/src/actions/remove-from-queue
        with:
          github-token: ${{ secrets.MERGE_QUEUE_TOKEN }}
```

Replace `YOUR-ORG` with your GitHub org/username.

### 4. Create Labels (2 minutes)

```bash
gh label create "ready" --color "0e8a16" --description "Add to merge queue"
gh label create "queued-for-merge" --color "fbca04"
gh label create "merge-processing" --color "1d76db"
gh label create "merge-updating" --color "5319e7"
gh label create "merge-queue-failed" --color "d73a4a"
gh label create "merge-queue-conflict" --color "b60205"
```

Or create manually in GitHub UI: Issues → Labels → New label

### 5. Test (5 minutes)

1. Create a test PR
2. Get it approved
3. Ensure checks pass
4. Add `ready` label
5. Watch it merge automatically!

## Usage

### Queue a PR

1. Create PR
2. Get approval(s)
3. Ensure tests pass
4. Add `ready` label
5. Done! Queue handles the rest

### Remove from Queue

- Remove `ready` label, or
- Close the PR

### Check Queue Status

Comments on your PR show:
- Queue position
- Processing status
- Merge result

## Common Issues

**Workflows don't run**
- Check Actions tab for errors
- Verify `MERGE_QUEUE_TOKEN` exists
- Ensure token has `repo` + `workflow` scopes

**PR not merging**
- Check PR comments for details
- Verify PR has required approvals
- Ensure all checks are passing
- Check for merge conflicts

**Permission errors**
- Verify PAT has access to both repos
- Check token hasn't expired

## Default Behavior

- **Approvals**: 1 required
- **Checks**: All must pass
- **Merge method**: Squash
- **Branch delete**: Yes
- **Auto-update**: Yes
- **Timeout**: 30 minutes

## Customization

Edit workflow files to customize:

```yaml
with:
  required-approvals: 2          # Change approval count
  merge-method: merge            # Use merge instead of squash
  delete-branch-after-merge: false  # Keep branches
  block-labels: do-not-merge,wip,draft  # Add blocking labels
```

## Next Steps

- 📖 Read [SETUP_GUIDE.md](docs/SETUP_GUIDE.md) for detailed setup
- 🏗️ Read [ARCHITECTURE.md](docs/ARCHITECTURE.md) to understand how it works
- 🧪 Read [TESTING_GUIDE.md](docs/TESTING_GUIDE.md) for testing
- 🤝 Read [CONTRIBUTING.md](CONTRIBUTING.md) to contribute

## Support

- 📚 [Full Documentation](README.md)
- 🐛 [Report Issues](https://github.com/YOUR-ORG/merge-queue/issues)
- 💬 [Discussions](https://github.com/YOUR-ORG/merge-queue/discussions)

## Quick Reference

### Labels

| Label | Meaning |
|-------|---------|
| `ready` | Add PR to queue |
| `queued-for-merge` | Waiting in queue |
| `merge-processing` | Being processed |
| `merge-updating` | Branch updating |
| `merge-queue-failed` | Failed validation |
| `merge-queue-conflict` | Has conflicts |

### Workflow Triggers

- **Entry**: When `ready` label added
- **Manager**: Every 5 min + push to main
- **Remove**: When `ready` removed or PR closed

### Required Permissions

- `repo` - Full repository access
- `workflow` - Update workflows
- `contents: write` - Merge PRs
- `pull-requests: write` - Comment & label

---

**Ready to merge automatically? Add the `ready` label!** 🚀

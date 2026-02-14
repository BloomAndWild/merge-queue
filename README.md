# GitHub Merge Queue

A TypeScript-based GitHub merge queue utility that automatically validates and merges approved PRs sequentially. This is a standalone reusable repository that provides custom GitHub Actions for any repository to use.

## Features

- **Sequential Processing**: Process one PR at a time to ensure each is tested against the latest master
- **Auto-Update Branches**: Automatically merge master into PR branches when they fall behind
- **Smart Validation**: Validates approvals, required checks, and merge conflicts
- **Multi-Repository Support**: Each repository gets its own independent queue
- **Zero Configuration**: State files auto-created, no manual setup needed
- **Self-Service**: Add to any repository without modifying the merge-queue codebase

## How It Works

1. Label a PR with "ready" to add it to the queue
2. The queue manager validates the PR (approved, checks passing, up-to-date)
3. If the branch is behind master, it automatically merges master into the PR
4. GitHub automatically re-runs tests after the update
5. Once tests pass, the PR is automatically merged
6. The queue moves to the next PR

## Architecture

### Key Components

- **Queue Manager**: Runs every 5 minutes via cron + on push to master
- **Queue State**: Stored as JSON files in the `merge-queue-state` branch
- **Custom Actions**: Three reusable GitHub Actions for queue management
  - `add-to-queue`: Add a PR to the queue
  - `process-queue`: Process the next PR in the queue
  - `remove-from-queue`: Remove a PR from the queue

### Repository Structure

```
/src/
  /core/           # Core business logic
    - github-api.ts       # GitHub API wrapper
    - queue-state.ts      # State management
  /actions/        # GitHub Action definitions
    - add-to-queue/
    - process-queue/
    - remove-from-queue/
  /utils/          # Logging, constants, errors
  /types/          # TypeScript interfaces
```

## Setup for Target Repositories

To add the merge queue to your repository:

### 1. Add Workflow Files

Copy these three workflow files to your repository's `.github/workflows/` directory:

- `merge-queue-entry.yml` - Triggered when "ready" label is added
- `merge-queue-manager.yml` - Runs every 5 minutes and on push to master
- `merge-queue-remove.yml` - Triggered when label is removed or PR is closed

See the [examples/](examples/) directory for templates.

### 2. Configure GitHub Token

Create a Personal Access Token (PAT) with the following permissions:
- `repo` - Full repository access
- `workflow` - Update GitHub Actions workflows

Add it as a secret in your repository:
- Name: `MERGE_QUEUE_TOKEN`
- Value: Your PAT

### 3. Add the "ready" Label

Add a PR to the queue by applying the "ready" label. The queue will automatically:
- Validate the PR
- Add it to the queue
- Process it when its turn comes
- Merge it when all checks pass

## Configuration

Configure the queue behavior via workflow inputs:

```yaml
with:
  github-token: ${{ secrets.MERGE_QUEUE_TOKEN }}
  queue-label: 'ready'                # Label to trigger queue entry
  required-approvals: 1               # Minimum required approvals
  merge-method: 'squash'              # merge, squash, or rebase
  auto-update-branch: true            # Auto-merge master when behind
  update-timeout-minutes: 30          # Max wait time for tests after update
```

## Development

### Prerequisites

- Node.js 20.x or higher
- npm

### Install Dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test
```

### Lint

```bash
npm run lint
```

## Publishing

This repository should be published to GitHub and tagged for versioning:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Target repositories will reference actions like:

```yaml
uses: your-org/merge-queue@v1/src/actions/add-to-queue
```

## State Management

Queue state is stored in the `merge-queue-state` branch with one file per repository:

- Naming pattern: `{owner}-{repo}-queue.json`
- Auto-created on first use
- Atomic updates with conflict detection

## Error Handling

The queue handles various failure scenarios:

- **Checks failing**: PR removed from queue with failure label
- **Merge conflicts**: PR removed with conflict label
- **Tests fail after update**: PR removed with detailed error message
- **Manual merge**: Queue detects and skips gracefully
- **API errors**: Retry with exponential backoff

## Labels

Standard labels used by the queue:

- `ready` - Trigger label to add PR to queue
- `queued-for-merge` - PR is waiting in queue
- `merge-processing` - PR is currently being processed
- `merge-updating` - PR branch is being updated with master
- `merge-queue-failed` - PR failed validation or tests
- `merge-queue-conflict` - Merge conflict detected

## Security

- Never commit tokens or secrets
- Use minimal required permissions for PAT
- Validate all inputs from GitHub events
- State files are versioned and validated

## License

MIT

## Contributing

See [CLAUDE.md](CLAUDE.md) for development guidelines.

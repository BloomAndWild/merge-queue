# GitHub Merge Queue

A TypeScript-based GitHub merge queue utility that automatically validates and merges approved PRs sequentially. This is a standalone reusable repository that provides custom GitHub Actions for any repository to use.

## Features

- **Sequential Processing**: Process one PR at a time to ensure each is tested against the latest master
- **Auto-Update Branches**: Automatically merge master into PR branches when they fall behind
- **Smart Validation**: Validates required checks, draft state, blocking labels, and merge conflicts
- **Multi-Repository Support**: Each repository gets its own independent queue
- **Zero Configuration**: No setup needed — labels are the source of truth
- **Self-Service**: Add to any repository without modifying the merge-queue codebase
- **Concurrency-Safe**: Multiple PRs can be labeled "ready" simultaneously without issues

## How It Works

1. Label a PR with "ready" to add it to the queue
2. The queue manager validates the PR (checks passing, up-to-date)
3. If the branch is behind master, it automatically merges master into the PR
4. GitHub automatically re-runs tests after the update
5. Once tests pass, the PR is automatically merged
6. The queue moves to the next PR

Queue state is tracked entirely through GitHub labels — the `queued-for-merge` label means a PR is in the queue, and `merge-processing` means it's currently being worked on. No external state files or branches are needed.

## Architecture

### Key Components

- **Queue Manager**: Triggered by workflow_run after add/remove, plus self-dispatch while queue has items
- **Queue State**: Tracked via GitHub labels (`queued-for-merge`, `merge-processing`)
- **Custom Actions**: Three reusable GitHub Actions for queue management
  - `add-to-queue`: Validate a PR and add it to the queue
  - `process-queue`: Process the next PR in the queue
  - `remove-from-queue`: Remove a PR from the queue

### Repository Structure

```
/src/
  /core/           # Core business logic
    - github-api.ts       # GitHub API wrapper
    - pr-validator.ts      # PR validation logic
    - branch-updater.ts    # Branch update logic
    - merger.ts            # PR merge logic
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
- `merge-queue-manager.yml` - Triggered after entry/remove workflows + self-dispatch
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
- Add the `queued-for-merge` label
- Process it when its turn comes
- Merge it when all checks pass

## Configuration

Configure the queue behavior via workflow inputs:

```yaml
with:
  github-token: ${{ secrets.MERGE_QUEUE_TOKEN }}
  queue-label: 'ready'                # Label that triggers queue entry
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

## Making Changes & Releasing

Target repositories reference the actions by **git tag** (e.g. `@v1`), and GitHub
Actions runs the **bundled `dist/` files**, not the TypeScript source. This means
every source change must be built, committed, and re-tagged before consumers pick
it up.

### Step-by-step workflow

```bash
# 1. Make your source changes in /src
#    e.g. edit src/core/github-api.ts

# 2. Build — compiles TypeScript and bundles each action with ncc
npm run build

# 3. Commit both source and dist changes
git add -A
git commit -m "Description of your change"

# 4. Move the floating major-version tag so consumers get the update
git tag -fa v1 -m "Release v1 — <short description>"
git push origin main --follow-tags
git push origin v1 --force

# For a new minor/patch release, also create a fixed tag:
git tag v1.1.0
git push origin v1.1.0
```

### Why the dist files must be committed

Each action's `action.yml` declares `runs.using: node20` with `main: dist/index.js`.
GitHub downloads the repository at the referenced tag and runs that file directly —
there is no build step at runtime. If the dist files are stale, consumers run old code.

### Tag conventions

| Tag | Purpose | Mutable? |
|---------|---------------------------------------------|----------|
| `v1` | Floating tag consumers reference (`@v1`) | Yes |
| `v1.x.y`| Fixed release for auditability | No |

Target repositories reference actions like:

```yaml
uses: your-org/merge-queue@v1/src/actions/add-to-queue
```

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

## License

MIT

## Contributing

See [CLAUDE.md](CLAUDE.md) for development guidelines.

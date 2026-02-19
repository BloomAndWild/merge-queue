# Quick Start Guide

Get your merge queue up and running in 15 minutes.

## Prerequisites

- GitHub repository with admin access
- Node.js 20.x installed

## 5-Minute Setup

### 1. Create a GitHub App (2 minutes)

The merge queue authenticates via a GitHub App. Installation tokens are
generated automatically on each workflow run — no expiration, no manual
rotation.

1. Go to your **org settings** → Developer settings → GitHub Apps → **New GitHub App**
2. Set **Webhook** to inactive (not needed)
3. Under **Repository permissions**, set:
   | Permission | Access |
   |---|---|
   | **Pull requests** | Read & Write |
   | **Contents** | Read & Write |
   | **Actions** | Read & Write |
   | **Commit statuses** | Read |
   | **Checks** | Read |
   | **Metadata** | Read |
4. Click **Create GitHub App**, then note the **App ID**
5. Under **Private keys**, click **Generate a private key** (downloads a `.pem` file)
6. Click **Install App** in the sidebar → select your org → choose the target repositories
7. In each target repository, add:
   - **Variable** `MERGE_QUEUE_APP_ID` → the App ID (Settings → Secrets and variables → Actions → Variables)
   - **Secret** `MERGE_QUEUE_APP_PRIVATE_KEY` → contents of the `.pem` file (Settings → Secrets and variables → Actions → Secrets)

### 2. Add Workflows (5 minutes)

Create `.github/workflows/` directory and add three files:

**merge-queue-entry.yml**:
```yaml
name: Merge Queue Entry
on:
  pull_request:
    types: [labeled]

jobs:
  add-to-queue:
    # Set the MERGE_QUEUE_LABEL repo variable to customise (defaults to "ready")
    if: github.event.label.name == (vars.MERGE_QUEUE_LABEL || 'ready')
    runs-on: ubuntu-latest
    steps:
      - id: app-token
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ vars.MERGE_QUEUE_APP_ID }}
          private-key: ${{ secrets.MERGE_QUEUE_APP_PRIVATE_KEY }}
      - uses: BloomAndWild/merge-queue@v1/src/actions/add-to-queue
        with:
          github-token: ${{ steps.app-token.outputs.token }}
          queue-label: ${{ vars.MERGE_QUEUE_LABEL || 'ready' }}
          ignore-checks: 'Add PR to Merge Queue,Remove PR from Merge Queue,Process Merge Queue'
```

**merge-queue-manager.yml**:
```yaml
name: Merge Queue Manager
on:
  workflow_dispatch:
  workflow_run:
    workflows: ["Merge Queue Entry", "Merge Queue Remove"]
    types: [completed]

concurrency:
  group: merge-queue-processor
  cancel-in-progress: false

jobs:
  process-queue:
    runs-on: ubuntu-latest
    steps:
      - id: app-token
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ vars.MERGE_QUEUE_APP_ID }}
          private-key: ${{ secrets.MERGE_QUEUE_APP_PRIVATE_KEY }}
      - id: process
        uses: BloomAndWild/merge-queue@v1/src/actions/process-queue
        with:
          github-token: ${{ steps.app-token.outputs.token }}
          queue-label: ${{ vars.MERGE_QUEUE_LABEL || 'ready' }}
          ignore-checks: 'Add PR to Merge Queue,Remove PR from Merge Queue,Process Merge Queue'
      - name: Process next in queue
        if: steps.process.outputs.processed == 'true'
        env:
          GH_TOKEN: ${{ steps.app-token.outputs.token }}
        run: gh workflow run "${{ github.workflow }}" --repo "${{ github.repository }}"
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
      (github.event.action == 'unlabeled' && github.event.label.name == (vars.MERGE_QUEUE_LABEL || 'ready')) ||
      github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - id: app-token
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ vars.MERGE_QUEUE_APP_ID }}
          private-key: ${{ secrets.MERGE_QUEUE_APP_PRIVATE_KEY }}
      - uses: BloomAndWild/merge-queue@v1/src/actions/remove-from-queue
        with:
          github-token: ${{ steps.app-token.outputs.token }}
```

Replace `BloomAndWild` with your GitHub org/username.

### 3. Create Labels (2 minutes)

Create the trigger label (use your custom name if you set `MERGE_QUEUE_LABEL`):

```bash
gh label create "ready" --color "0e8a16" --description "Add to merge queue"  # or your custom label name
gh label create "queued-for-merge" --color "fbca04"
gh label create "merge-processing" --color "1d76db"
gh label create "merge-updating" --color "5319e7"
gh label create "merge-queue-failed" --color "d73a4a"
gh label create "merge-queue-conflict" --color "b60205"
```

Or create manually in GitHub UI: Issues → Labels → New label

### 4. (Optional) Customise the Trigger Label

By default the queue is triggered by the `ready` label. To use a different name:

1. Go to your repository → **Settings → Secrets and variables → Actions → Variables**
2. Click **New repository variable**
3. Name: `MERGE_QUEUE_LABEL`, Value: your preferred label name (e.g. `ship-it`)
4. Create the matching label in step 3 above

The example workflows already reference this variable with a fallback to `ready`, so no workflow file edits are needed.

### 5. Test (5 minutes)

1. Create a test PR
2. Get it approved
3. Ensure checks pass
4. Add your trigger label (default: `ready`)
5. Watch it merge automatically!

## Usage

### Queue a PR

1. Create PR
2. Get approval(s)
3. Ensure tests pass
4. Add the trigger label (default: `ready`)
5. Done! Queue handles the rest

### Remove from Queue

- Remove the trigger label, or
- Close the PR

### Check Queue Status

Comments on your PR show:
- Whether it was added to the queue
- Processing status
- Merge result

You can also check which PRs are queued by searching for the `queued-for-merge` label in your repository.

## Common Issues

**Workflows don't run**
- Check Actions tab for errors
- Verify `MERGE_QUEUE_APP_ID` variable and `MERGE_QUEUE_APP_PRIVATE_KEY` secret exist
- Confirm the GitHub App is still installed on the repository
- Ensure the App has the required permissions (see Step 1 above)

**PR not merging / "checks no longer passing"**
- Check PR comments for details
- Verify PR has required approvals
- Ensure all checks are passing
- Check for merge conflicts
- If the failing check is a merge queue workflow itself (e.g. "Add PR to Merge Queue"),
  add `ignore-checks` to your workflow inputs (see Customization below)

**Permission errors**
- Check the App's permissions match the table in Step 1
- Verify the App is installed on this specific repository

## Default Behavior

- **Approvals**: At least one approval required, no outstanding changes requested
- **Checks**: All must pass
- **Merge method**: Squash
- **Branch delete**: Yes
- **Auto-update**: Yes
- **Timeout**: 30 minutes

## Customization

Edit workflow files to customize:

```yaml
with:
  merge-method: merge            # Use merge instead of squash
  delete-branch-after-merge: false  # Keep branches
  block-labels: do-not-merge,wip,draft  # Add blocking labels
  ignore-checks: 'Add PR to Merge Queue,Remove PR from Merge Queue,Process Merge Queue'
```

> **Important**: When `require-all-checks: true` (the default), the merge queue
> validates that all CI checks on the PR pass. This includes the merge queue's
> own workflow runs. Use `ignore-checks` to exclude those workflow job names so
> they don't create a circular dependency where a previous failed run blocks the
> PR from being re-queued. The values should match the `name:` of the jobs in
> your workflow files.

## Slack Notifications (Optional)

Get Slack messages when PRs are merged or fail to merge, with rich formatting that includes the PR title, author, repository, and a direct link.

### 1. Create a Slack Incoming Webhook

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) and create a new app (or use an existing one)
2. Under **Incoming Webhooks**, toggle it on
3. Click **Add New Webhook to Workspace** and pick the channel to post to
4. Copy the webhook URL (starts with `https://hooks.slack.com/services/...`)

### 2. Add the Secret

In your repository:
1. Settings → Secrets → New secret
2. Name: `SLACK_WEBHOOK_URL`
3. Value: [paste webhook URL]

### 3. Add the Notify Step

Add this step to your `merge-queue-manager.yml` **after** the process step and **before** the self-dispatch step:

```yaml
- name: Notify Slack
  if: steps.process.outputs.processed == 'true'
  uses: BloomAndWild/merge-queue@v1/src/actions/notify
  with:
    slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    github-token: ${{ steps.app-token.outputs.token }}
    repository: ${{ github.repository }}
    pr-number: ${{ steps.process.outputs.pr-number }}
    result: ${{ steps.process.outputs.result }}
```

Replace `BloomAndWild` with your GitHub org/username.

Notifications are sent for `merged`, `failed`, and `conflict` results. The notify step never fails the workflow — if Slack is unreachable, a warning is logged and the queue continues normally.

## Next Steps

- Read [SETUP_GUIDE.md](docs/SETUP_GUIDE.md) for detailed setup
- Read [ARCHITECTURE.md](docs/ARCHITECTURE.md) to understand how it works
- Read [TESTING_GUIDE.md](docs/TESTING_GUIDE.md) for testing
- Read [CONTRIBUTING.md](CONTRIBUTING.md) to contribute

## Support

- [Full Documentation](README.md)
- [Report Issues](https://github.com/BloomAndWild/merge-queue/issues)
- [Discussions](https://github.com/BloomAndWild/merge-queue/discussions)

## Quick Reference

### Labels

| Label | Meaning |
|-------|---------|
| `ready` | Add PR to queue (configurable via `MERGE_QUEUE_LABEL` repo variable) |
| `queued-for-merge` | Waiting in queue |
| `merge-processing` | Being processed |
| `merge-updating` | Branch updating |
| `merge-queue-failed` | Failed validation |
| `merge-queue-conflict` | Has conflicts |

### Workflow Triggers

- **Entry**: When the trigger label is added (default: `ready`)
- **Manager**: After entry/remove workflows complete + self-dispatch while queue has items
- **Remove**: When the trigger label is removed or PR is closed

### Required GitHub App Permissions

| Permission | Access |
|---|---|
| Pull requests | Read & Write |
| Contents | Read & Write |
| Actions | Read & Write |
| Commit statuses | Read |
| Checks | Read |
| Metadata | Read |

---

**Ready to merge automatically? Add the trigger label (default: `ready`)!**

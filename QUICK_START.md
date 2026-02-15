# Quick Start Guide

Get your merge queue up and running in 15 minutes.

## Prerequisites

- GitHub repository with admin access
- Node.js 20.x installed

## 5-Minute Setup

### 1. Create a Bot User & PAT (2 minutes)

We recommend creating a dedicated bot account (e.g. `yourorg-merge-bot`) with
**write** (not admin) collaborator access. A non-admin account cannot bypass
branch protection rules, so required approvals and status checks are always
enforced by GitHub in addition to the merge queue's own validation.

**Create the bot user's fine-grained PAT:**

1. Log in as the bot account
2. Go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens**
3. Click **"Generate new token"**
4. Configure:
   - **Token name**: `Merge Queue Token`
   - **Expiration**: 90 days (set a calendar reminder to rotate)
   - **Resource owner**: Your org or personal account
   - **Repository access**: Select only the repositories that need the merge queue
5. Under **Repository permissions**, set:
   | Permission | Access | Why |
   |---|---|---|
   | **Pull requests** | Read & Write | Merge PRs, post comments, manage labels |
   | **Contents** | Read & Write | Update branches, delete merged branches |
   | **Actions** | Read & Write | Trigger workflow self-dispatch |
   | **Commit statuses** | Read | Read CI status results for validation |
   | **Metadata** | Read | Required by default |
6. Click **"Generate token"** and copy it immediately

<details>
<summary>Alternative: Classic PAT</summary>

If you can't use fine-grained tokens (e.g. org policy restrictions):

1. Go to https://github.com/settings/tokens
2. Generate new token (classic)
3. Check `repo` and `workflow` scopes
4. Copy token

> **Important**: Ensure the classic PAT belongs to a non-admin user (e.g. the bot
> account above). Admin tokens can bypass branch protection rules.

</details>

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
    # Set the MERGE_QUEUE_LABEL repo variable to customise (defaults to "ready")
    if: github.event.label.name == (vars.MERGE_QUEUE_LABEL || 'ready')
    runs-on: ubuntu-latest
    steps:
      - uses: YOUR-ORG/merge-queue@v1/src/actions/add-to-queue
        with:
          github-token: ${{ secrets.MERGE_QUEUE_TOKEN }}
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
      - id: process
        uses: YOUR-ORG/merge-queue@v1/src/actions/process-queue
        with:
          github-token: ${{ secrets.MERGE_QUEUE_TOKEN }}
          queue-label: ${{ vars.MERGE_QUEUE_LABEL || 'ready' }}
          ignore-checks: 'Add PR to Merge Queue,Remove PR from Merge Queue,Process Merge Queue'
      - name: Process next in queue
        if: steps.process.outputs.processed == 'true'
        env:
          GH_TOKEN: ${{ secrets.MERGE_QUEUE_TOKEN }}
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
      - uses: YOUR-ORG/merge-queue@v1/src/actions/remove-from-queue
        with:
          github-token: ${{ secrets.MERGE_QUEUE_TOKEN }}
```

Replace `YOUR-ORG` with your GitHub org/username.

### 4. Create Labels (2 minutes)

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

### 5. (Optional) Customise the Trigger Label

By default the queue is triggered by the `ready` label. To use a different name:

1. Go to your repository → **Settings → Secrets and variables → Actions → Variables**
2. Click **New repository variable**
3. Name: `MERGE_QUEUE_LABEL`, Value: your preferred label name (e.g. `ship-it`)
4. Create the matching label in step 4 above

The example workflows already reference this variable with a fallback to `ready`, so no workflow file edits are needed.

### 6. Test (5 minutes)

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
- Verify `MERGE_QUEUE_TOKEN` exists
- Ensure token has the required permissions (see Step 1 above)

**PR not merging / "checks no longer passing"**
- Check PR comments for details
- Verify PR has required approvals
- Ensure all checks are passing
- Check for merge conflicts
- If the failing check is a merge queue workflow itself (e.g. "Add PR to Merge Queue"),
  add `ignore-checks` to your workflow inputs (see Customization below)

**Permission errors**
- Verify PAT has access to the repo
- Check token hasn't expired

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
  uses: YOUR-ORG/merge-queue@v1/src/actions/notify
  with:
    slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    github-token: ${{ secrets.MERGE_QUEUE_TOKEN }}
    repository: ${{ github.repository }}
    pr-number: ${{ steps.process.outputs.pr-number }}
    result: ${{ steps.process.outputs.result }}
```

Replace `YOUR-ORG` with your GitHub org/username.

Notifications are sent for `merged`, `failed`, and `conflict` results. The notify step never fails the workflow — if Slack is unreachable, a warning is logged and the queue continues normally.

## Next Steps

- Read [SETUP_GUIDE.md](docs/SETUP_GUIDE.md) for detailed setup
- Read [ARCHITECTURE.md](docs/ARCHITECTURE.md) to understand how it works
- Read [TESTING_GUIDE.md](docs/TESTING_GUIDE.md) for testing
- Read [CONTRIBUTING.md](CONTRIBUTING.md) to contribute

## Support

- [Full Documentation](README.md)
- [Report Issues](https://github.com/YOUR-ORG/merge-queue/issues)
- [Discussions](https://github.com/YOUR-ORG/merge-queue/discussions)

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

### Required Token Permissions (Fine-Grained PAT)

| Permission | Access |
|---|---|
| Pull requests | Read & Write |
| Contents | Read & Write |
| Actions | Read & Write |
| Commit statuses | Read |
| Metadata | Read |

---

**Ready to merge automatically? Add the trigger label (default: `ready`)!**

# Merge Queue Setup Guide

This guide walks you through setting up the merge queue for your repository.

## Prerequisites

- Repository must be on GitHub
- You need admin access to the target repository
- Node.js 20.x installed (for local development/testing)

## Part 1: Merge Queue Repository Setup

### Step 1: Create the Merge Queue Repository

If you haven't already:

1. Create a new repository on GitHub:
   - Name: `merge-queue`
   - Visibility: Private (recommended) or Public
   - Initialize with README: No (we have our own)

2. Push the merge-queue code:
   ```bash
   cd /path/to/merge-queue
   git remote add origin git@github.com:BloomAndWild/merge-queue.git
   git push -u origin main
   ```

### Step 2: Build and Tag a Release

1. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

2. Create initial release:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. Verify the tag appears on GitHub under Releases

That's it for the merge-queue repo — no state branch or additional setup needed.

## Part 2: Target Repository Setup

### Step 1: Set Up Authentication

The merge queue needs a token with write access to your repository. You have
two options: a **GitHub App** (recommended) or a **Personal Access Token (PAT)**.

#### Option A: GitHub App (Recommended)

A GitHub App generates short-lived installation tokens automatically — no
manual rotation, no user seat required, and a better audit trail.

##### 1. Create the GitHub App

1. Go to your **organization settings** → Developer settings → GitHub Apps → **New GitHub App**
   (or for a personal account: Settings → Developer settings → GitHub Apps)

2. Configure the app:
   - **GitHub App name**: `Merge Queue` (or any unique name)
   - **Homepage URL**: Your merge-queue repository URL
   - **Webhook**: Uncheck "Active" (not needed)

3. Under **Repository permissions**, set:

   | Permission | Access | Why |
   |---|---|---|
   | **Pull requests** | Read & Write | Merge PRs, post comments, manage labels |
   | **Contents** | Read & Write | Update branches, delete merged branches |
   | **Actions** | Read & Write | Trigger workflow self-dispatch |
   | **Commit statuses** | Read | Read CI status results for validation |
   | **Checks** | Read | Read check run results for validation |
   | **Metadata** | Read | Required by default |

4. Under **Where can this GitHub App be installed?**, select "Only on this account"

5. Click **"Create GitHub App"**

6. Note the **App ID** shown on the app's settings page

7. Scroll down to **Private keys** and click **"Generate a private key"** — a `.pem`
   file will download automatically

##### 2. Install the App

1. On the app's settings page, click **"Install App"** in the sidebar

2. Select your organization (or personal account)

3. Choose **"Only select repositories"** and pick the repositories that need the merge queue

4. Click **"Install"**

##### 3. Add Secrets and Variables

In each target repository:

1. Go to **Settings → Secrets and variables → Actions**

2. Under the **Variables** tab, click "New repository variable":
   - **Name**: `MERGE_QUEUE_APP_ID`
   - **Value**: The App ID from step 6 above

3. Under the **Secrets** tab, click "New repository secret":
   - **Name**: `MERGE_QUEUE_APP_PRIVATE_KEY`
   - **Value**: Paste the full contents of the `.pem` file you downloaded

#### Option B: Personal Access Token (PAT)

If you prefer a PAT (or your org doesn't allow GitHub Apps), create a
dedicated bot account with a fine-grained PAT.

> **Note**: PATs expire and require manual rotation. Consider a GitHub App
> (Option A) to avoid this maintenance burden.

##### 1. Create a bot account

1. Create a new GitHub account for the bot (e.g. `yourorg-merge-bot`)
2. In the target repository: Settings → Collaborators → Add the bot with **Write** role

##### 2. Create a fine-grained PAT (Recommended)

Log in as the bot account, then:

1. Go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens**

2. Click **"Generate new token"**

3. Configure the token:
   - **Token name**: `Merge Queue Token`
   - **Expiration**: 90 days or custom (set a calendar reminder to rotate)
   - **Resource owner**: Your org or personal account
   - **Repository access**: Select only the repositories that need the merge queue

4. Under **Repository permissions**, set:

   | Permission | Access | Why |
   |---|---|---|
   | **Pull requests** | Read & Write | Merge PRs, post comments, manage labels |
   | **Contents** | Read & Write | Update branches, delete merged branches |
   | **Actions** | Read & Write | Trigger workflow self-dispatch |
   | **Commit statuses** | Read | Read CI status results for validation |
   | **Metadata** | Read | Required by default |

5. Click **"Generate token"** and **copy the token immediately** (you won't see it again)

##### Alternative: Classic PAT

If you can't use fine-grained tokens (e.g. org policy restrictions):

1. Log in as the bot account
2. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
3. Click "Generate new token (classic)"
4. Configure the token:
   - **Note**: "Merge Queue Token"
   - **Expiration**: 90 days or custom (set calendar reminder)
   - **Scopes**:
     - ✅ `repo` (Full control of private repositories)
     - ✅ `workflow` (Update GitHub Actions workflows)
5. Click "Generate token" and **copy the token immediately** (you won't see it again)

> **Important**: Always use a non-admin bot account for the PAT. Admin tokens
> can bypass GitHub branch protection rules at the API level.

##### 3. Add Token as Secret

In your target repository:

1. Go to Settings → Secrets and variables → Actions

2. Click "New repository secret"

3. Configure:
   - **Name**: `MERGE_QUEUE_TOKEN`
   - **Value**: Paste the PAT you created

4. Click "Add secret"

### Step 2: Add Workflow Files

Pick the example workflows that match the authentication method you chose in
Step 1:

- **GitHub App** → `examples/target-repo-workflows-github-app/`
- **PAT** → `examples/target-repo-workflows/`

1. Create `.github/workflows/` directory if it doesn't exist:
   ```bash
   mkdir -p .github/workflows
   ```

2. Copy the three workflow files from the merge-queue repository:

   **Using curl (GitHub App)**
   ```bash
   cd .github/workflows/
   BASE=https://raw.githubusercontent.com/BloomAndWild/merge-queue/main/examples/target-repo-workflows-github-app

   curl -O "$BASE/merge-queue-entry.yml"
   curl -O "$BASE/merge-queue-manager.yml"
   curl -O "$BASE/merge-queue-remove.yml"
   ```

   **Using curl (PAT)**
   ```bash
   cd .github/workflows/
   BASE=https://raw.githubusercontent.com/BloomAndWild/merge-queue/main/examples/target-repo-workflows

   curl -O "$BASE/merge-queue-entry.yml"
   curl -O "$BASE/merge-queue-manager.yml"
   curl -O "$BASE/merge-queue-remove.yml"
   ```

   **Manual copy**
   - Copy files from the appropriate `examples/` subdirectory
   - Paste into your repo's `.github/workflows/`

3. Update the workflow files:

   Find and replace `BloomAndWild` with your GitHub organization/username:

   ```yaml
   # Before
   uses: BloomAndWild/merge-queue@v1/src/actions/add-to-queue

   # After
   uses: mycompany/merge-queue@v1/src/actions/add-to-queue
   ```

4. Customize configuration (optional):

   Edit the workflow files to adjust settings like:
   - `merge-method`: `squash`, `merge`, or `rebase`
   - `block-labels`: Labels that prevent queueing
   - `update-timeout-minutes`: How long to wait for tests

   To customise the trigger label, set the `MERGE_QUEUE_LABEL` repository
   variable instead of editing workflow files — the example workflows already
   reference it with a fallback to `ready`.

### Step 3: Create Labels

The queue uses several labels. Create them in your repository.

> **Tip**: The trigger label defaults to `ready`. To use a different name, set
> the `MERGE_QUEUE_LABEL` repository variable (Settings → Secrets and variables
> → Actions → Variables) and create a label with that name instead.

1. Go to Issues → Labels → New label

2. Create these labels:

   | Label | Color | Description |
   |-------|-------|-------------|
   | `ready` (or your custom trigger label) | `#0e8a16` (green) | Add this to queue a PR |
   | `queued-for-merge` | `#fbca04` (yellow) | PR is waiting in queue |
   | `merge-processing` | `#1d76db` (blue) | PR is being processed |
   | `merge-updating` | `#5319e7` (purple) | Branch is being updated |
   | `merge-queue-failed` | `#d73a4a` (red) | Validation or tests failed |
   | `merge-queue-conflict` | `#b60205` (dark red) | Merge conflict detected |

   **Quick create script:**
   ```bash
   # Requires GitHub CLI (gh)
   # Replace "ready" with your custom label name if you set MERGE_QUEUE_LABEL
   gh label create "ready" --color "0e8a16" --description "Add this to queue a PR"
   gh label create "queued-for-merge" --color "fbca04" --description "PR is waiting in queue"
   gh label create "merge-processing" --color "1d76db" --description "PR is being processed"
   gh label create "merge-updating" --color "5319e7" --description "Branch is being updated"
   gh label create "merge-queue-failed" --color "d73a4a" --description "Validation or tests failed"
   gh label create "merge-queue-conflict" --color "b60205" --description "Merge conflict detected"
   ```

### Step 4: Commit and Push

```bash
git add .github/workflows/
git commit -m "Add merge queue workflows"
git push origin main
```

## Part 3: Testing

### Test 1: Create a Test PR

1. Create a simple PR (fix typo, update README, etc.)

2. Get it approved (ensure it has required approvals)

3. Ensure all checks are passing

4. Add the trigger label (default: `ready`)

5. Watch for:
   - ✅ `queued-for-merge` label added
   - ✅ Comment confirming addition to queue

### Test 2: Verify Queue Processing

1. Wait up to 5 minutes (or manually trigger the queue-manager workflow)

2. Watch for:
   - ✅ `merge-processing` label added
   - ✅ PR automatically merged
   - ✅ Branch deleted (if configured)
   - ✅ Success comment posted

### Test 3: Test Failure Handling

1. Create a PR with failing tests

2. Add the trigger label (default: `ready`)

3. Verify:
   - ✅ `merge-queue-failed` label added
   - ✅ Comment explaining failure
   - ✅ PR removed from queue

### Test 4: Test Branch Update

1. Create PR #1 and merge it manually

2. Create PR #2 (now behind master)

3. Add the trigger label (default: `ready`) to PR #2

4. Verify:
   - ✅ Branch automatically updated
   - ✅ Tests re-run
   - ✅ PR merges after tests pass

## Part 4: Configuration

### Customizing Queue Behavior

Edit `.github/workflows/merge-queue-entry.yml` and `merge-queue-manager.yml`:

```yaml
with:
  # Merge method
  merge-method: squash     # Change to 'merge' or 'rebase'

  # Branch deletion
  delete-branch-after-merge: true  # Change to false to keep branches

  # Blocking labels
  block-labels: do-not-merge,wip,draft  # Add custom labels

  # Test timeout
  update-timeout-minutes: 30  # Increase for slow test suites
```

## Troubleshooting

### Issue: Workflows don't run

**Cause**: Token permissions or workflow file errors

**Solution**:
1. Check Actions tab for error messages
2. Validate workflow YAML syntax
3. **GitHub App**: Verify `MERGE_QUEUE_APP_ID` variable and `MERGE_QUEUE_APP_PRIVATE_KEY` secret exist. Confirm the App is still installed on the repository.
4. **PAT**: Verify `MERGE_QUEUE_TOKEN` secret exists. Ensure token has `repo` and `workflow` scopes.

### Issue: "Permission denied" errors

**Cause**: Insufficient permissions on the token

**Solution**:
1. **GitHub App**: Check the App's permission settings match the table in Step 1. Verify the App is installed on this specific repository.
2. **PAT**: Verify PAT has access to the repository. Check token hasn't expired.

### Issue: PRs not merging

**Cause**: Validation failures or queue stuck

**Solution**:
1. Check PR comments for error details
2. View Actions logs in target repository
3. Search for PRs with `queued-for-merge` or `merge-processing` labels to see queue state
4. Manually trigger queue-manager workflow

### Issue: Tests timeout

**Cause**: Tests take longer than configured timeout

**Solution**:
- Increase `update-timeout-minutes` in workflows
- Optimize test suite performance

## Monitoring

### View Queue State

Search for open PRs with queue labels to see the current state:

- **Waiting**: PRs with `queued-for-merge` label
- **Processing**: PRs with `merge-processing` label
- **Failed**: PRs with `merge-queue-failed` or `merge-queue-conflict` label

### View Action Logs

1. Go to target repository → Actions tab

2. Select workflow run

3. View logs for debugging

## Maintenance

### Token Rotation

**GitHub App**: No manual token rotation is needed. Installation tokens are
generated automatically on each workflow run and expire after one hour. If you
need to rotate the App's private key, generate a new one on the App settings
page, update the `MERGE_QUEUE_APP_PRIVATE_KEY` secret in each target
repository, and optionally revoke the old key.

**PAT**: When the PAT expires:

1. Create new PAT (same process as Step 1, Option B)

2. Update `MERGE_QUEUE_TOKEN` secret in all target repos

3. Test with a dummy PR

### Updating Merge Queue

When new version is released:

1. Pull latest changes to merge-queue repo:
   ```bash
   git pull origin main
   ```

2. Tag new release:
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```

3. Update workflow files in target repos:
   ```yaml
   # Change from
   uses: BloomAndWild/merge-queue@v1.0.0/src/actions/add-to-queue

   # To
   uses: BloomAndWild/merge-queue@v1.1.0/src/actions/add-to-queue
   ```

## Best Practices

1. **Token Security**
   - **Prefer a GitHub App** over a PAT — tokens are short-lived, auto-generated, and not tied to a user account
   - If using a PAT: use a dedicated bot account with **write** (not admin) access, use a fine-grained PAT scoped to only the required repositories and permissions, set expiration reminders, and rotate regularly
   - If using a GitHub App: ensure it is installed only on repositories that need the merge queue, and restrict the "Where can this GitHub App be installed?" setting to your own account
   - Never commit tokens, private keys, or secrets to git

2. **Testing**
   - Test queue with dummy PRs first
   - Monitor first few real PRs closely
   - Keep eye on Action logs initially

3. **Configuration**
   - Start with default settings
   - Adjust based on team workflow
   - Document custom configurations

4. **Communication**
   - Inform team about merge queue
   - Document in repository README
   - Create team guide for using the trigger label (default: `ready`)

## Next Steps

- Read [ARCHITECTURE.md](ARCHITECTURE.md) to understand internals
- Check [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines
- Join discussions for questions and feedback

## Support

- **Documentation**: Check `/docs` directory
- **Issues**: Report bugs on GitHub
- **Questions**: Use GitHub Discussions

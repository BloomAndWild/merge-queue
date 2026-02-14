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
   git remote add origin git@github.com:your-org/merge-queue.git
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

### Step 1: Create Personal Access Token (PAT)

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)

2. Click "Generate new token (classic)"

3. Configure the token:
   - **Note**: "Merge Queue Token"
   - **Expiration**: 90 days or custom (set calendar reminder)
   - **Scopes**:
     - ✅ `repo` (Full control of private repositories)
     - ✅ `workflow` (Update GitHub Actions workflows)

4. Click "Generate token" and **copy the token immediately** (you won't see it again)

### Step 2: Add Token as Secret

In your target repository:

1. Go to Settings → Secrets and variables → Actions

2. Click "New repository secret"

3. Configure:
   - **Name**: `MERGE_QUEUE_TOKEN`
   - **Value**: Paste the PAT you created

4. Click "Add secret"

### Step 3: Add Workflow Files

1. Create `.github/workflows/` directory if it doesn't exist:
   ```bash
   mkdir -p .github/workflows
   ```

2. Copy the three workflow files from the merge-queue repository:

   **Option A: Using curl**
   ```bash
   cd .github/workflows/

   # Download workflow files
   curl -O https://raw.githubusercontent.com/your-org/merge-queue/main/examples/target-repo-workflows/merge-queue-entry.yml
   curl -O https://raw.githubusercontent.com/your-org/merge-queue/main/examples/target-repo-workflows/merge-queue-manager.yml
   curl -O https://raw.githubusercontent.com/your-org/merge-queue/main/examples/target-repo-workflows/merge-queue-remove.yml
   ```

   **Option B: Manual copy**
   - Copy files from `merge-queue/examples/target-repo-workflows/`
   - Paste into your repo's `.github/workflows/`

3. Update the workflow files:

   Find and replace `your-org` with your GitHub organization/username:

   ```yaml
   # Before
   uses: your-org/merge-queue@v1/src/actions/add-to-queue

   # After
   uses: mycompany/merge-queue@v1/src/actions/add-to-queue
   ```

4. Customize configuration (optional):

   Edit the workflow files to adjust settings like:
   - `merge-method`: `squash`, `merge`, or `rebase`
   - `block-labels`: Labels that prevent queueing
   - `update-timeout-minutes`: How long to wait for tests

### Step 4: Create Labels

The queue uses several labels. Create them in your repository:

1. Go to Issues → Labels → New label

2. Create these labels:

   | Label | Color | Description |
   |-------|-------|-------------|
   | `ready` | `#0e8a16` (green) | Add this to queue a PR |
   | `queued-for-merge` | `#fbca04` (yellow) | PR is waiting in queue |
   | `merge-processing` | `#1d76db` (blue) | PR is being processed |
   | `merge-updating` | `#5319e7` (purple) | Branch is being updated |
   | `merge-queue-failed` | `#d73a4a` (red) | Validation or tests failed |
   | `merge-queue-conflict` | `#b60205` (dark red) | Merge conflict detected |

   **Quick create script:**
   ```bash
   # Requires GitHub CLI (gh)
   gh label create "ready" --color "0e8a16" --description "Add this to queue a PR"
   gh label create "queued-for-merge" --color "fbca04" --description "PR is waiting in queue"
   gh label create "merge-processing" --color "1d76db" --description "PR is being processed"
   gh label create "merge-updating" --color "5319e7" --description "Branch is being updated"
   gh label create "merge-queue-failed" --color "d73a4a" --description "Validation or tests failed"
   gh label create "merge-queue-conflict" --color "b60205" --description "Merge conflict detected"
   ```

### Step 5: Commit and Push

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

4. Add the `ready` label

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

2. Add `ready` label

3. Verify:
   - ✅ `merge-queue-failed` label added
   - ✅ Comment explaining failure
   - ✅ PR removed from queue

### Test 4: Test Branch Update

1. Create PR #1 and merge it manually

2. Create PR #2 (now behind master)

3. Add `ready` label to PR #2

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
2. Verify `MERGE_QUEUE_TOKEN` secret exists
3. Validate workflow YAML syntax
4. Ensure token has `repo` and `workflow` scopes

### Issue: "Permission denied" errors

**Cause**: PAT doesn't have sufficient permissions

**Solution**:
1. Verify PAT has access to the repository
2. Check token hasn't expired

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

When PAT expires:

1. Create new PAT (same process as Step 1)

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
   uses: your-org/merge-queue@v1.0.0/src/actions/add-to-queue

   # To
   uses: your-org/merge-queue@v1.1.0/src/actions/add-to-queue
   ```

## Best Practices

1. **Token Security**
   - Use PAT with minimal required scopes
   - Set expiration and calendar reminders
   - Rotate regularly
   - Never commit tokens to git

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
   - Create team guide for using `ready` label

## Next Steps

- Read [ARCHITECTURE.md](ARCHITECTURE.md) to understand internals
- Check [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines
- Join discussions for questions and feedback

## Support

- **Documentation**: Check `/docs` directory
- **Issues**: Report bugs on GitHub
- **Questions**: Use GitHub Discussions

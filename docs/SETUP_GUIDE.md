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

### Step 3: Initialize the State Branch

The state branch will be automatically created when the first repository uses the queue, but you can initialize it manually:

```bash
# Create orphan branch for state storage
git checkout --orphan merge-queue-state

# Remove all files
git rm -rf .

# Create placeholder README
echo "# Merge Queue State Storage" > README.md
echo "" >> README.md
echo "This branch stores queue state files for all repositories." >> README.md
echo "Files are automatically created and managed by the merge queue actions." >> README.md

# Commit and push
git add README.md
git commit -m "Initialize merge-queue-state branch"
git push origin merge-queue-state

# Return to main branch
git checkout main
```

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

   Find and replace in all three files:
   - `your-org` → Your GitHub organization/username
   - `merge-queue` → Your merge queue repo name (if different)

   Example:
   ```yaml
   # Before
   uses: your-org/merge-queue@v1/src/actions/add-to-queue

   # After
   uses: mycompany/merge-queue@v1/src/actions/add-to-queue
   ```

4. Customize configuration (optional):

   Edit the workflow files to adjust settings like:
   - `required-approvals`: Number of approvals needed
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
   - ✅ Comment showing queue position
   - ✅ Queue state file created in merge-queue repo

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
  # Number of approvals required
  required-approvals: 1    # Change to 2 for stricter requirements

  # Merge method
  merge-method: squash     # Change to 'merge' or 'rebase'

  # Branch deletion
  delete-branch-after-merge: true  # Change to false to keep branches

  # Blocking labels
  block-labels: do-not-merge,wip,draft  # Add custom labels

  # Test timeout
  update-timeout-minutes: 30  # Increase for slow test suites
```

### Advanced: Priority Queue

Add priority to specific PRs:

```yaml
# In merge-queue-entry.yml, add:
with:
  priority: 10  # Higher priority PRs processed first
```

For dynamic priority based on labels:

```yaml
priority: ${{ contains(github.event.pull_request.labels.*.name, 'urgent') && '10' || '0' }}
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

**Cause**: PAT doesn't have access to merge-queue repo

**Solution**:
1. Verify PAT has access to both repos
2. If merge-queue is in different org, ensure PAT has org access
3. Check token hasn't expired

### Issue: PRs not merging

**Cause**: Validation failures or queue stuck

**Solution**:
1. Check PR comments for error details
2. View Actions logs in target repository
3. Check queue state file in merge-queue repo
4. Manually trigger queue-manager workflow

### Issue: State file conflicts

**Cause**: Concurrent updates (rare)

**Solution**:
- Built-in retry logic should handle this
- If persists, manually trigger queue-manager

### Issue: Tests timeout

**Cause**: Tests take longer than configured timeout

**Solution**:
- Increase `update-timeout-minutes` in workflows
- Optimize test suite performance

## Monitoring

### View Queue State

1. Navigate to merge-queue repository

2. Switch to `merge-queue-state` branch

3. Open your queue file: `{owner}-{repo}-queue.json`

4. Review:
   - Current PR being processed
   - PRs waiting in queue
   - Recent history
   - Success/failure stats

### View Action Logs

1. Go to target repository → Actions tab

2. Select workflow run

3. View logs for debugging

### Queue Statistics

Check `stats` in queue state file:

```json
{
  "stats": {
    "total_processed": 42,
    "total_merged": 38,
    "total_failed": 4
  }
}
```

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

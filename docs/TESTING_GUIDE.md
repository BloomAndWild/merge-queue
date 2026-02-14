# Testing Guide

This guide covers testing strategies and procedures for the merge queue system.

## Unit Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- src/core/__tests__/queue-state.test.ts
```

### Writing Tests

Tests are located in `__tests__` directories alongside the code they test:

```
src/
  core/
    queue-state.ts
    __tests__/
      queue-state.test.ts
```

Example test:

```typescript
import { PRValidator } from '../pr-validator';
import { GitHubAPI } from '../github-api';

describe('PRValidator', () => {
  let validator: PRValidator;
  let mockAPI: jest.Mocked<GitHubAPI>;

  beforeEach(() => {
    mockAPI = {
      getPullRequest: jest.fn(),
      getPRReviews: jest.fn(),
      // ... other mocked methods
    } as any;

    validator = new PRValidator(mockAPI, defaultConfig);
  });

  it('should validate a valid PR', async () => {
    // Arrange
    mockAPI.getPullRequest.mockResolvedValue({
      state: 'open',
      draft: false,
      // ... other properties
    });

    // Act
    const result = await validator.validate(123);

    // Assert
    expect(result.valid).toBe(true);
  });
});
```

### Test Coverage Goals

- **Overall**: >80% coverage
- **Core modules**: >90% coverage
- **Utils**: >85% coverage
- **Actions**: >75% coverage (harder to test due to GitHub Actions SDK)

## Integration Testing

### Prerequisites

- Test GitHub repository with admin access
- Personal Access Token with required permissions
- Merge queue repository set up and tagged

### Test Scenarios

#### 1. Basic Queue Flow

**Goal**: Verify end-to-end queue functionality

**Steps**:
1. Create a PR with passing tests
2. Get PR approved
3. Add "ready" label
4. Verify PR is added to queue
5. Wait for queue processing
6. Verify PR is merged automatically

**Expected Results**:
- ✅ PR added to queue with position comment
- ✅ "queued-for-merge" label added
- ✅ Queue manager processes PR
- ✅ PR merged successfully
- ✅ Branch deleted (if configured)
- ✅ Success comment added

#### 2. Validation Failure

**Goal**: Verify PRs that don't meet requirements are rejected

**Test Cases**:

a. **Insufficient Approvals**
- Create PR without approval
- Add "ready" label
- Expect: Rejected with "insufficient approvals" message

b. **Failing Checks**
- Create PR with failing tests
- Get PR approved
- Add "ready" label
- Expect: Rejected with "failed checks" message

c. **Draft PR**
- Create draft PR
- Add "ready" label (if allow-draft: false)
- Expect: Rejected with "draft state" message

d. **Blocking Label**
- Create valid PR
- Add "do-not-merge" label
- Add "ready" label
- Expect: Rejected with "blocking label" message

#### 3. Branch Auto-Update

**Goal**: Verify automatic branch updates when PR falls behind

**Steps**:
1. Create PR #1 and merge it
2. Create PR #2 (now behind master)
3. Get PR #2 approved with passing tests
4. Add "ready" label to PR #2
5. Observe queue processing

**Expected Results**:
- ✅ Queue detects PR is behind
- ✅ "merge-updating" label added
- ✅ Master merged into PR branch
- ✅ Tests re-run automatically
- ✅ Tests pass
- ✅ PR merged after tests complete

#### 4. Merge Conflict Handling

**Goal**: Verify conflicts are detected and handled

**Steps**:
1. Create PR #1 modifying file X
2. Create PR #2 also modifying file X (conflicting changes)
3. Merge PR #1
4. Add "ready" label to PR #2 (now has conflicts)

**Expected Results**:
- ✅ Conflict detected during validation or update
- ✅ "merge-queue-conflict" label added
- ✅ PR removed from queue
- ✅ Comment explains conflict

#### 5. Test Failure After Update

**Goal**: Verify handling when tests fail after branch update

**Steps**:
1. Create PR with code that passes tests
2. Merge another PR that changes test requirements
3. Add "ready" label to first PR
4. Observe queue updating branch and tests failing

**Expected Results**:
- ✅ Branch updated successfully
- ✅ Tests fail after update
- ✅ "merge-queue-failed" label added
- ✅ PR removed from queue
- ✅ Comment explains test failure

#### 6. Manual Merge (Queue Bypass)

**Goal**: Verify queue handles PRs that are manually merged

**Steps**:
1. Create PR and add to queue
2. While in queue (but not yet processed), manually merge PR
3. Let queue try to process it

**Expected Results**:
- ✅ Queue detects PR is no longer open
- ✅ PR removed from queue
- ✅ No errors or failures
- ✅ Next PR in queue processes normally

#### 7. Multiple PRs in Queue

**Goal**: Verify sequential processing

**Steps**:
1. Create 3 PRs (all valid and approved)
2. Add "ready" label to all 3 quickly
3. Observe queue processing

**Expected Results**:
- ✅ All 3 added to queue with positions
- ✅ Processed in FIFO order
- ✅ Each PR tested against latest master
- ✅ All merge successfully

#### 8. Priority Queue

**Goal**: Verify priority-based ordering

**Steps**:
1. Create PR #1 with priority 0
2. Create PR #2 with priority 10
3. Add both to queue (PR #1 first)
4. Verify PR #2 processes before PR #1

**Expected Results**:
- ✅ PR #2 (higher priority) processes first
- ✅ PR #1 processes second

#### 9. Concurrent Queue Protection

**Goal**: Verify concurrency controls prevent race conditions

**Steps**:
1. Trigger queue-manager workflow manually twice rapidly
2. Observe both workflow runs

**Expected Results**:
- ✅ Only one workflow runs at a time
- ✅ Second workflow waits for first to complete
- ✅ No state corruption

#### 10. Multi-Repository Queues

**Goal**: Verify independent queues for different repositories

**Steps**:
1. Set up merge queue in Repo A
2. Set up merge queue in Repo B
3. Add PRs to both queues
4. Process simultaneously

**Expected Results**:
- ✅ Separate state files created
- ✅ Queues process independently
- ✅ No interference between repos

## Edge Case Testing

### Edge Cases to Test

1. **PR Closed While in Queue**
   - Add PR to queue
   - Close PR
   - Verify removed from queue

2. **Label Removed While Processing**
   - Add PR to queue
   - While processing, remove "ready" label
   - Verify processing completes but PR removed from queue

3. **Approval Removed While in Queue**
   - Add approved PR to queue
   - Remove approval
   - Verify PR rejected when its turn comes

4. **Very Long Queue**
   - Add 20+ PRs to queue
   - Verify all process correctly
   - Check performance and logs

5. **Network Failures**
   - Simulate API timeouts
   - Verify retry logic works
   - Verify graceful failure after retries exhausted

6. **State File Corruption**
   - Manually corrupt state file JSON
   - Trigger queue processing
   - Verify error handling

7. **Extremely Long Test Times**
   - PR with tests that take >30 minutes
   - Verify timeout handling
   - Verify PR removed with timeout message

## Manual Validation Checklist

Before releasing a new version, manually verify:

### Basic Functionality
- [ ] PR can be added to queue with "ready" label
- [ ] PR validation rejects invalid PRs
- [ ] Queue processes PRs in FIFO order
- [ ] PRs merge automatically when conditions met
- [ ] Comments show queue position and status
- [ ] Labels update correctly throughout lifecycle

### Validation
- [ ] Rejects PRs without required approvals
- [ ] Rejects PRs with failing checks
- [ ] Rejects draft PRs (when configured)
- [ ] Rejects PRs with blocking labels
- [ ] Rejects PRs with merge conflicts

### Branch Updates
- [ ] Detects when PR is behind master
- [ ] Automatically updates branch
- [ ] Waits for tests to complete
- [ ] Merges after tests pass
- [ ] Removes from queue if tests fail

### Error Handling
- [ ] Handles merge conflicts gracefully
- [ ] Handles test failures
- [ ] Handles manual merges
- [ ] Handles closed PRs
- [ ] Retries transient failures

### State Management
- [ ] State persists across workflow runs
- [ ] State file auto-created for new repos
- [ ] Concurrent updates handled correctly
- [ ] History tracks completed PRs

### Workflows
- [ ] queue-manager runs on schedule
- [ ] queue-manager runs on push to master
- [ ] queue-entry runs on label add
- [ ] queue-remove runs on label removal
- [ ] Concurrency controls work

### Cleanup
- [ ] Branches deleted after merge (if configured)
- [ ] Labels removed correctly
- [ ] Success comments posted

## Performance Testing

### Metrics to Measure

1. **Queue Wait Time**
   - Average time from add to merge
   - Target: <30 minutes for valid PRs

2. **Validation Time**
   - Time to validate a PR
   - Target: <30 seconds

3. **Merge Time**
   - Time from start processing to merge complete
   - Target: <2 minutes (excluding test time)

4. **State Operations**
   - Time to read/write state
   - Target: <5 seconds

### Load Testing

Test with:
- 10 PRs in queue
- 50 PRs in queue
- 100 PRs processed (not simultaneously)

Verify:
- Performance degradation is acceptable
- No timeouts or errors
- State file size remains manageable

## Debugging Tests

### Common Issues

**Tests fail with API errors**:
- Check token permissions
- Verify repository access
- Check rate limits

**Tests timeout**:
- Increase jest timeout:
  ```typescript
  jest.setTimeout(30000); // 30 seconds
  ```

**Mocks not working**:
- Verify mock setup in `beforeEach`
- Check mock return values match expected types
- Use `mockResolvedValue` for promises

### Debug Output

Enable debug logging:

```typescript
// In tests
process.env.ACTIONS_STEP_DEBUG = 'true';
```

View detailed logs:

```bash
npm test -- --verbose
```

## Continuous Integration

### GitHub Actions

Our CI runs:
- Unit tests on every push
- Linting on every push
- Type checking on every push
- Coverage report on PRs

### Required Checks

Before merging to main:
- ✅ All tests pass
- ✅ Linting passes
- ✅ Type checking passes
- ✅ Coverage >80%

## Test Data Management

### Test Repositories

Use dedicated test repositories:
- `merge-queue-test-1`: Basic functionality testing
- `merge-queue-test-2`: Edge case testing
- `merge-queue-test-3`: Performance testing

### Cleanup

After testing:
1. Delete test PRs
2. Clear queue state files
3. Remove test labels
4. Archive test branches

## Reporting Issues

When tests fail:

1. **Collect Information**:
   - Test output
   - Action logs
   - State file contents
   - PR details

2. **Create Issue**:
   - Describe expected vs actual behavior
   - Include reproduction steps
   - Attach logs and screenshots
   - Tag with `bug` label

3. **Fix and Verify**:
   - Write failing test
   - Implement fix
   - Verify test passes
   - Verify manual test passes

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Clear Names**: Use descriptive test names
3. **Arrange-Act-Assert**: Follow AAA pattern
4. **Mock External Deps**: Don't hit real GitHub API in unit tests
5. **Test Edge Cases**: Don't just test happy path
6. **Keep Tests Fast**: Unit tests should run in milliseconds
7. **Update Tests**: When code changes, update tests too

## Resources

- [Jest Documentation](https://jestjs.io/)
- [GitHub Actions Testing](https://docs.github.com/en/actions/automating-builds-and-tests)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

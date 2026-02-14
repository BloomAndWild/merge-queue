/**
 * Queue state management with Git-based persistence
 */

import { getOctokit } from '@actions/github';
import { GitHub } from '@actions/github/lib/utils';
import { StateError, ConcurrencyError, isGitHubError } from '../utils/errors';
import { Logger, createLogger } from '../utils/logger';
import { STATE_BRANCH, QUEUE_VERSION } from '../utils/constants';
import type {
  QueueState,
  QueuedPR,
  CurrentPR,
  HistoryEntry,
  RepositoryInfo,
} from '../types/queue';

type Octokit = InstanceType<typeof GitHub>;

/**
 * Generate state file name for a repository
 */
export function getStateFileName(repo: RepositoryInfo): string {
  return `${repo.owner}-${repo.repo}-queue.json`;
}

/**
 * Create an empty queue state
 */
export function createEmptyState(): QueueState {
  return {
    version: QUEUE_VERSION,
    updated_at: new Date().toISOString(),
    current: null,
    queue: [],
    history: [],
    stats: {
      total_processed: 0,
      total_merged: 0,
      total_failed: 0,
    },
  };
}

/**
 * Queue state manager with Git-based persistence
 */
export class QueueStateManager {
  private octokit: Octokit;
  private logger: Logger;
  private stateFileName: string;

  constructor(
    token: string,
    private mergeQueueRepo: RepositoryInfo,
    private targetRepo: RepositoryInfo,
    logger?: Logger
  ) {
    this.octokit = getOctokit(token);
    this.logger = logger || createLogger({
      component: 'QueueStateManager',
      targetRepo: `${targetRepo.owner}/${targetRepo.repo}`,
    });
    this.stateFileName = getStateFileName(targetRepo);
  }

  /**
   * Initialize the state branch if it doesn't exist
   */
  async initializeStateBranch(): Promise<void> {
    this.logger.info('Checking if state branch exists');

    try {
      await this.octokit.rest.repos.getBranch({
        owner: this.mergeQueueRepo.owner,
        repo: this.mergeQueueRepo.repo,
        branch: STATE_BRANCH,
      });

      this.logger.debug('State branch already exists');
    } catch (error: unknown) {
      if (isGitHubError(error) && error.status === 404) {
        this.logger.info('State branch does not exist, creating it');
        await this.createStateBranch();
      } else {
        const message = error instanceof Error ? error.message : String(error);
        throw new StateError(`Failed to check state branch: ${message}`);
      }
    }
  }

  /**
   * Create the state branch
   */
  private async createStateBranch(): Promise<void> {
    try {
      // Get the default branch to use as base
      const { data: repo } = await this.octokit.rest.repos.get({
        owner: this.mergeQueueRepo.owner,
        repo: this.mergeQueueRepo.repo,
      });

      const defaultBranch = repo.default_branch;

      // Get the latest commit from default branch
      const { data: ref } = await this.octokit.rest.git.getRef({
        owner: this.mergeQueueRepo.owner,
        repo: this.mergeQueueRepo.repo,
        ref: `heads/${defaultBranch}`,
      });

      // Create the new branch
      await this.octokit.rest.git.createRef({
        owner: this.mergeQueueRepo.owner,
        repo: this.mergeQueueRepo.repo,
        ref: `refs/heads/${STATE_BRANCH}`,
        sha: ref.object.sha,
      });

      this.logger.info('State branch created successfully');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new StateError(`Failed to create state branch: ${message}`);
    }
  }

  /**
   * Read the queue state from the state branch
   */
  async readState(): Promise<QueueState> {
    this.logger.debug('Reading queue state', { stateFileName: this.stateFileName });

    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.mergeQueueRepo.owner,
        repo: this.mergeQueueRepo.repo,
        path: this.stateFileName,
        ref: STATE_BRANCH,
      });

      if (Array.isArray(data) || data.type !== 'file') {
        throw new StateError('State file is not a file');
      }

      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      const state = JSON.parse(content) as QueueState;

      this.validateState(state);
      return state;
    } catch (error: unknown) {
      if (isGitHubError(error) && error.status === 404) {
        // State file doesn't exist for this repo yet, create it
        this.logger.info('State file does not exist, creating empty state', {
          stateFileName: this.stateFileName,
        });

        const emptyState = createEmptyState();
        await this.writeState(emptyState);
        return emptyState;
      }

      if (error instanceof StateError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new StateError(`Failed to read state: ${message}`);
    }
  }

  /**
   * Write the queue state to the state branch.
   *
   * Throws ConcurrencyError on 409 conflict so that callers (atomicUpdate)
   * can re-read fresh state and retry the full mutation.
   */
  async writeState(state: QueueState): Promise<void> {
    this.logger.debug('Writing queue state', { stateFileName: this.stateFileName });

    // Ensure state branch exists
    await this.initializeStateBranch();

    // Update timestamp
    state.updated_at = new Date().toISOString();

    // Validate state before writing
    this.validateState(state);

    const content = JSON.stringify(state, null, 2);
    const contentBase64 = Buffer.from(content, 'utf-8').toString('base64');

    try {
      // Try to get existing file to get its SHA
      let sha: string | undefined;
      try {
        const { data } = await this.octokit.rest.repos.getContent({
          owner: this.mergeQueueRepo.owner,
          repo: this.mergeQueueRepo.repo,
          path: this.stateFileName,
          ref: STATE_BRANCH,
        });

        if (!Array.isArray(data) && data.type === 'file') {
          sha = data.sha;
        }
      } catch (error: unknown) {
        if (!isGitHubError(error) || error.status !== 404) {
          throw error;
        }
        // File doesn't exist yet, will create it
      }

      // Create or update the file
      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.mergeQueueRepo.owner,
        repo: this.mergeQueueRepo.repo,
        path: this.stateFileName,
        message: `Update queue state for ${this.targetRepo.owner}/${this.targetRepo.repo}`,
        content: contentBase64,
        branch: STATE_BRANCH,
        sha,
      });

      this.logger.info('Queue state written successfully');
    } catch (error: unknown) {
      if (isGitHubError(error) && error.status === 409) {
        throw new ConcurrencyError(
          'State update conflict — another process modified the state concurrently'
        );
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new StateError(`Failed to write state: ${message}`);
    }
  }

  /**
   * Perform a state mutation atomically using a compare-and-swap loop.
   *
   * Reads the latest state, applies the mutation function, then attempts to
   * write. If a 409 conflict occurs (another process wrote in between), the
   * entire cycle is retried with fresh state — ensuring no updates are lost.
   *
   * @param mutate - Function that receives the latest state and returns a result.
   *                 It should mutate the state object in-place.
   * @param maxRetries - Maximum number of retry attempts (default: 5).
   * @returns The value returned by the mutate function on the successful attempt.
   */
  async atomicUpdate<T>(
    mutate: (state: QueueState) => T,
    maxRetries = 5
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Always read the latest state at the start of each attempt
      const state = await this.readState();

      // Apply the caller's mutation
      const result = mutate(state);

      try {
        await this.writeState(state);
        return result;
      } catch (error: unknown) {
        if (error instanceof ConcurrencyError && attempt < maxRetries) {
          // Exponential backoff with jitter to avoid thundering herd
          const delay = 1000 * Math.pow(2, attempt) + Math.random() * 1000;
          this.logger.warning(
            `State conflict on attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${Math.round(delay)}ms`,
            { stateFileName: this.stateFileName }
          );
          await this.sleep(delay);
          continue;
        }
        throw error;
      }
    }

    // Should be unreachable, but satisfy TypeScript
    throw new ConcurrencyError(
      `State update failed after ${maxRetries + 1} attempts`
    );
  }

  /**
   * Add a PR to the queue (concurrency-safe).
   *
   * Uses atomicUpdate to ensure that concurrent add operations don't
   * overwrite each other — each attempt re-reads the latest state.
   */
  async addToQueue(pr: QueuedPR): Promise<number> {
    return this.atomicUpdate((state) => {
      // Check if PR is already in queue
      if (state.queue.some(q => q.pr_number === pr.pr_number)) {
        this.logger.warning('PR already in queue', { prNumber: pr.pr_number });
        return state.queue.findIndex(q => q.pr_number === pr.pr_number) + 1;
      }

      // Check if PR is currently being processed
      if (state.current?.pr_number === pr.pr_number) {
        this.logger.warning('PR is currently being processed', {
          prNumber: pr.pr_number,
        });
        return 0; // Position 0 means it's being processed
      }

      // Add to queue
      state.queue.push(pr);

      // Sort by priority (higher first) then by added_at (earlier first)
      state.queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return new Date(a.added_at).getTime() - new Date(b.added_at).getTime();
      });

      const position = state.queue.findIndex(q => q.pr_number === pr.pr_number) + 1;
      this.logger.info('PR added to queue', { prNumber: pr.pr_number, position });

      return position;
    });
  }

  /**
   * Remove a PR from the queue (concurrency-safe).
   */
  async removeFromQueue(prNumber: number): Promise<boolean> {
    return this.atomicUpdate((state) => {
      const index = state.queue.findIndex(q => q.pr_number === prNumber);

      if (index === -1) {
        this.logger.warning('PR not found in queue', { prNumber });
        return false;
      }

      state.queue.splice(index, 1);
      this.logger.info('PR removed from queue', { prNumber });
      return true;
    });
  }

  /**
   * Get the next PR from the queue
   */
  async getNextPR(): Promise<QueuedPR | null> {
    const state = await this.readState();

    if (state.queue.length === 0) {
      return null;
    }

    return state.queue[0];
  }

  /**
   * Set the current PR being processed (concurrency-safe).
   */
  async setCurrentPR(current: CurrentPR | null): Promise<void> {
    await this.atomicUpdate((state) => {
      state.current = current;
      this.logger.info('Current PR updated', { current });
    });
  }

  /**
   * Update current PR status (concurrency-safe).
   */
  async updateCurrentStatus(
    status: CurrentPR['status'],
    updated_at?: string
  ): Promise<void> {
    await this.atomicUpdate((state) => {
      if (!state.current) {
        throw new StateError('No current PR to update');
      }

      state.current.status = status;
      if (updated_at) {
        state.current.updated_at = updated_at;
      }

      this.logger.debug('Current PR status updated', { status });
    });
  }

  /**
   * Complete processing of current PR and add to history (concurrency-safe).
   */
  async completeCurrentPR(entry: HistoryEntry): Promise<void> {
    await this.atomicUpdate((state) => {
      if (!state.current) {
        throw new StateError('No current PR to complete');
      }

      // Remove from queue if still there
      state.queue = state.queue.filter(
        q => q.pr_number !== state.current!.pr_number
      );

      // Add to history
      state.history.unshift(entry);

      // Keep only last 100 history entries
      if (state.history.length > 100) {
        state.history = state.history.slice(0, 100);
      }

      // Update stats
      state.stats.total_processed++;
      if (entry.result === 'merged') {
        state.stats.total_merged++;
      } else if (entry.result === 'failed' || entry.result === 'conflict') {
        state.stats.total_failed++;
      }

      // Clear current
      state.current = null;

      this.logger.info('Current PR completed', { entry });
    });
  }

  /**
   * Get queue position for a PR
   */
  async getQueuePosition(prNumber: number): Promise<number | null> {
    const state = await this.readState();

    if (state.current?.pr_number === prNumber) {
      return 0; // Currently being processed
    }

    const index = state.queue.findIndex(q => q.pr_number === prNumber);
    return index === -1 ? null : index + 1;
  }

  /**
   * Validate queue state structure
   */
  private validateState(state: QueueState): void {
    if (!state.version || typeof state.version !== 'string') {
      throw new StateError('Invalid state: missing or invalid version');
    }

    if (!state.updated_at || typeof state.updated_at !== 'string') {
      throw new StateError('Invalid state: missing or invalid updated_at');
    }

    if (!Array.isArray(state.queue)) {
      throw new StateError('Invalid state: queue must be an array');
    }

    if (!Array.isArray(state.history)) {
      throw new StateError('Invalid state: history must be an array');
    }

    if (!state.stats || typeof state.stats !== 'object') {
      throw new StateError('Invalid state: missing or invalid stats');
    }
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

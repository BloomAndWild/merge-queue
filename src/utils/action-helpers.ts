/**
 * Shared helper utilities for GitHub Action entry points
 */

import * as core from '@actions/core';
import type { QueueConfig, RepositoryInfo, MergeMethod } from '../types/queue';

const VALID_MERGE_METHODS: MergeMethod[] = ['merge', 'squash', 'rebase'];

/**
 * Parse a repository string in "owner/repo" format into a RepositoryInfo object.
 * Rejects strings with more or fewer than exactly one slash.
 */
export function parseRepository(repoString: string): RepositoryInfo {
  const parts = repoString.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid repository format: "${repoString}". Expected "owner/repo".`);
  }
  return { owner: parts[0], repo: parts[1] };
}

/**
 * Parse and validate a PR number string.
 * Throws if the value is not a positive integer.
 */
export function parsePRNumber(input: string): number {
  const prNumber = parseInt(input, 10);
  if (isNaN(prNumber) || prNumber <= 0) {
    throw new Error(`Invalid pr-number: "${input}". Must be a positive integer.`);
  }
  return prNumber;
}

/**
 * Build a QueueConfig from GitHub Action inputs.
 * Validates numeric fields and the merge-method enum.
 */
export function getConfig(): QueueConfig {
  const mergeMethod = core.getInput('merge-method');
  if (!VALID_MERGE_METHODS.includes(mergeMethod as MergeMethod)) {
    throw new Error(
      `Invalid merge method: "${mergeMethod}". Must be one of: ${VALID_MERGE_METHODS.join(', ')}`
    );
  }

  const updateTimeoutMinutes = parseInt(core.getInput('update-timeout-minutes'), 10);
  if (isNaN(updateTimeoutMinutes) || updateTimeoutMinutes <= 0) {
    throw new Error(
      `Invalid update-timeout-minutes: "${core.getInput('update-timeout-minutes')}". Must be a positive integer.`
    );
  }

  const maxUpdateRetries = parseInt(core.getInput('max-update-retries'), 10);
  if (isNaN(maxUpdateRetries) || maxUpdateRetries <= 0) {
    throw new Error(
      `Invalid max-update-retries: "${core.getInput('max-update-retries')}". Must be a positive integer.`
    );
  }

  return {
    queueLabel: core.getInput('queue-label'),
    failedLabel: core.getInput('failed-label'),
    conflictLabel: core.getInput('conflict-label'),
    processingLabel: core.getInput('processing-label'),
    updatingLabel: core.getInput('updating-label'),
    queuedLabel: core.getInput('queued-label'),
    allowPendingChecks: core.getInput('allow-pending-checks') === 'true',
    allowDraft: core.getInput('allow-draft') === 'true',
    blockLabels: core
      .getInput('block-labels')
      .split(',')
      .map(l => l.trim())
      .filter(Boolean),
    autoUpdateBranch: core.getInput('auto-update-branch') === 'true',
    updateTimeoutMinutes,
    maxUpdateRetries,
    mergeMethod: mergeMethod as MergeMethod,
    deleteBranchAfterMerge: core.getInput('delete-branch-after-merge') === 'true',
    ignoreChecks: 'Add PR to Merge Queue,Remove PR from Merge Queue,Process Merge Queue,'
      .concat(core.getInput('ignore-checks'))
      .split(',')
      .map(c => c.trim())
      .filter(Boolean),
  };
}

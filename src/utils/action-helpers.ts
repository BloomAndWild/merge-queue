/**
 * Shared helper utilities for GitHub Action entry points
 */

import * as core from '@actions/core';
import type { QueueConfig, RepositoryInfo, MergeMethod } from '../types/queue';

const VALID_MERGE_METHODS: MergeMethod[] = ['merge', 'squash', 'rebase'];

/**
 * Parse a repository string in "owner/repo" format into a RepositoryInfo object
 */
export function parseRepository(repoString: string): RepositoryInfo {
  const [owner, repo] = repoString.split('/');
  if (!owner || !repo) {
    throw new Error(
      `Invalid repository format: "${repoString}". Expected "owner/repo".`
    );
  }
  return { owner, repo };
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

  const requiredApprovals = parseInt(core.getInput('required-approvals'), 10);
  if (isNaN(requiredApprovals) || requiredApprovals < 0) {
    throw new Error(
      `Invalid required-approvals: "${core.getInput('required-approvals')}". Must be a non-negative integer.`
    );
  }

  const updateTimeoutMinutes = parseInt(
    core.getInput('update-timeout-minutes'),
    10
  );
  if (isNaN(updateTimeoutMinutes) || updateTimeoutMinutes <= 0) {
    throw new Error(
      `Invalid update-timeout-minutes: "${core.getInput('update-timeout-minutes')}". Must be a positive integer.`
    );
  }

  return {
    queueLabel: core.getInput('queue-label'),
    failedLabel: core.getInput('failed-label'),
    conflictLabel: core.getInput('conflict-label'),
    processingLabel: core.getInput('processing-label'),
    updatingLabel: core.getInput('updating-label'),
    queuedLabel: core.getInput('queued-label'),
    requiredApprovals,
    requireAllChecks: core.getInput('require-all-checks') === 'true',
    allowDraft: core.getInput('allow-draft') === 'true',
    blockLabels: core
      .getInput('block-labels')
      .split(',')
      .map(l => l.trim())
      .filter(Boolean),
    autoUpdateBranch: core.getInput('auto-update-branch') === 'true',
    updateTimeoutMinutes,
    mergeMethod: mergeMethod as MergeMethod,
    deleteBranchAfterMerge:
      core.getInput('delete-branch-after-merge') === 'true',
  };
}

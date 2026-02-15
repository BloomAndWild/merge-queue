/**
 * Tests for Slack notifier
 */

import {
  buildSlackPayload,
  sendSlackNotification,
  type PRDetails,
  type SlackPayload,
} from '../slack-notifier';

describe('buildSlackPayload', () => {
  const basePR: PRDetails = {
    number: 42,
    title: 'Add widget feature',
    author: 'octocat',
    url: 'https://github.com/acme/repo/pull/42',
    repository: 'acme/repo',
  };

  it('should build a green payload for merged result', () => {
    const payload = buildSlackPayload({ result: 'merged', pr: basePR });

    expect(payload).not.toBeNull();
    const attachment = payload!.attachments[0];
    expect(attachment.color).toBe('#2ea44f');
    expect(attachment.fallback).toContain('#42');
    expect(attachment.fallback).toContain('Add widget feature');
    expect(attachment.fallback).toContain('acme/repo');
  });

  it('should build a red payload for failed result', () => {
    const payload = buildSlackPayload({ result: 'failed', pr: basePR });

    expect(payload).not.toBeNull();
    const attachment = payload!.attachments[0];
    expect(attachment.color).toBe('#d73a4a');
    expect(attachment.fallback).toContain('Failed');
  });

  it('should build a red payload for conflict result', () => {
    const payload = buildSlackPayload({ result: 'conflict', pr: basePR });

    expect(payload).not.toBeNull();
    const attachment = payload!.attachments[0];
    expect(attachment.color).toBe('#b60205');
    expect(attachment.fallback).toContain('Conflict');
  });

  it('should return null for removed result', () => {
    const payload = buildSlackPayload({ result: 'removed', pr: basePR });
    expect(payload).toBeNull();
  });

  it('should return null for unknown result types', () => {
    const payload = buildSlackPayload({
      result: 'none' as any,
      pr: basePR,
    });
    expect(payload).toBeNull();
  });

  it('should include PR details in the section fields', () => {
    const payload = buildSlackPayload({ result: 'merged', pr: basePR });

    const blocks = payload!.attachments[0].blocks;
    // Second block is the fields section
    const fieldsBlock = blocks[1];
    expect(fieldsBlock.type).toBe('section');
    if (fieldsBlock.type === 'section' && fieldsBlock.fields) {
      const fieldTexts = fieldsBlock.fields.map(f => f.text);
      expect(fieldTexts.some(t => t.includes('#42'))).toBe(true);
      expect(fieldTexts.some(t => t.includes('acme/repo'))).toBe(true);
      expect(fieldTexts.some(t => t.includes('octocat'))).toBe(true);
    }
  });

  it('should include a View Pull Request button', () => {
    const payload = buildSlackPayload({ result: 'merged', pr: basePR });

    const blocks = payload!.attachments[0].blocks;
    const actionsBlock = blocks[2];
    expect(actionsBlock.type).toBe('actions');
    if (actionsBlock.type === 'actions') {
      expect(actionsBlock.elements[0].url).toBe(basePR.url);
      expect(actionsBlock.elements[0].text.text).toBe('View Pull Request');
    }
  });

  it('should include a context block with timestamp', () => {
    const payload = buildSlackPayload({ result: 'merged', pr: basePR });

    const blocks = payload!.attachments[0].blocks;
    const contextBlock = blocks[3];
    expect(contextBlock.type).toBe('context');
    if (contextBlock.type === 'context') {
      expect(contextBlock.elements[0].text).toContain('Merge Queue');
    }
  });

  it('should include the correct header icon for each result', () => {
    const merged = buildSlackPayload({ result: 'merged', pr: basePR });
    const failed = buildSlackPayload({ result: 'failed', pr: basePR });
    const conflict = buildSlackPayload({ result: 'conflict', pr: basePR });

    const headerText = (p: SlackPayload) => {
      const block = p.attachments[0].blocks[0];
      return block.type === 'section' ? block.text.text : '';
    };

    expect(headerText(merged!)).toContain(':white_check_mark:');
    expect(headerText(failed!)).toContain(':x:');
    expect(headerText(conflict!)).toContain(':warning:');
  });
});

describe('sendSlackNotification', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should return true when webhook responds with 200', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    const payload = buildSlackPayload({
      result: 'merged',
      pr: {
        number: 1,
        title: 'Test',
        author: 'user',
        url: 'https://github.com/a/b/pull/1',
        repository: 'a/b',
      },
    })!;

    const result = await sendSlackNotification(
      'https://hooks.slack.com/services/T00/B00/xxx',
      payload
    );

    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/T00/B00/xxx',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('should return false when webhook responds with non-200', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const payload = buildSlackPayload({
      result: 'failed',
      pr: {
        number: 2,
        title: 'Broken',
        author: 'user',
        url: 'https://github.com/a/b/pull/2',
        repository: 'a/b',
      },
    })!;

    const result = await sendSlackNotification(
      'https://hooks.slack.com/services/T00/B00/xxx',
      payload
    );

    expect(result).toBe(false);
  });

  it('should send the payload as JSON in the request body', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

    const payload = buildSlackPayload({
      result: 'merged',
      pr: {
        number: 3,
        title: 'Feature',
        author: 'dev',
        url: 'https://github.com/a/b/pull/3',
        repository: 'a/b',
      },
    })!;

    await sendSlackNotification(
      'https://hooks.slack.com/services/T00/B00/xxx',
      payload
    );

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(callArgs[1].body as string);
    expect(body.attachments).toBeDefined();
    expect(body.attachments[0].color).toBe('#2ea44f');
  });
});

import { describe, expect, it } from 'vitest';
import { getModelIdFromConversationId } from '../get-model-id-from-conversation-id';

describe('getModelIdFromConversationId', () => {
  it('returns the deployment id for a simple (single-segment) deployment', () => {
    expect(
      getModelIdFromConversationId('conversations/bucket/gpt-4__My%20chat'),
    ).toBe('gpt-4');
  });

  it('returns the full deployment id for a multi-segment deployment', () => {
    expect(
      getModelIdFromConversationId(
        'conversations/bucket/anthropic/claude-3__My%20chat',
      ),
    ).toBe('anthropic/claude-3');
  });

  it('returns the full deployment id for a three-segment deployment', () => {
    expect(
      getModelIdFromConversationId(
        'conversations/bucket/provider/family/model__title',
      ),
    ).toBe('provider/family/model');
  });

  it('preserves percent-encoded characters in deployment id segments', () => {
    expect(
      getModelIdFromConversationId(
        'conversations/bucket/my%20org/model__title',
      ),
    ).toBe('my%20org/model');
  });

  it('includes the version suffix of an application deployment id', () => {
    expect(
      getModelIdFromConversationId(
        'conversations/bucket/applications/catalog/Team%2FApp%20One__0.0.1__title',
      ),
    ).toBe('applications/catalog/Team%2FApp%20One__0.0.1');
  });

  it('handles titles that contain double-underscore', () => {
    expect(
      getModelIdFromConversationId(
        'conversations/bucket/gpt-4__title__with__underscores',
      ),
    ).toBe('gpt-4');
  });

  it('handles titles that contain slashes (e.g. a date in the title)', () => {
    // title contains slashes which create extra path segments after the separator
    expect(
      getModelIdFromConversationId(
        'conversations/bucket/my-model-id__title%206/2/2026',
      ),
    ).toBe('my-model-id');
  });

  it('handles multi-segment deployment AND a title with slashes', () => {
    expect(
      getModelIdFromConversationId(
        'conversations/bucket/anthropic/claude-3__report%206/2/2026',
      ),
    ).toBe('anthropic/claude-3');
  });

  it('returns undefined when there is no double-underscore separator', () => {
    expect(
      getModelIdFromConversationId('conversations/bucket/gpt-4-no-title'),
    ).toBe(undefined);
  });

  it('returns undefined for a path shorter than 3 segments', () => {
    expect(getModelIdFromConversationId('bucket/gpt-4__title')).toBe(undefined);
    expect(getModelIdFromConversationId('gpt-4__title')).toBe(undefined);
  });

  it('handles an empty string gracefully', () => {
    expect(getModelIdFromConversationId('')).toBe(undefined);
  });
});

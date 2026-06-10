import { describe, expect, it } from 'vitest';
import { getConversationRoute, normalizeConversationId } from '../routes';

describe('normalizeConversationId', () => {
  it('keeps plain conversation id', () => {
    expect(normalizeConversationId('tenant/path')).toBe('tenant/path');
  });

  it('strips conversations prefix with leading slash', () => {
    expect(normalizeConversationId('/conversations/tenant/path')).toBe(
      'tenant/path',
    );
  });

  it('strips conversations prefix without leading slash', () => {
    expect(normalizeConversationId('conversations/tenant/path')).toBe(
      'tenant/path',
    );
  });
});

describe('getConversationRoute', () => {
  it('builds route for plain conversation id', () => {
    expect(getConversationRoute('tenant/path')).toBe(
      '/conversations/tenant/path',
    );
  });

  it('does not duplicate conversations prefix with leading slash', () => {
    expect(getConversationRoute('/conversations/tenant/path')).toBe(
      '/conversations/tenant/path',
    );
  });

  it('does not duplicate conversations prefix without leading slash', () => {
    expect(getConversationRoute('conversations/tenant/path')).toBe(
      '/conversations/tenant/path',
    );
  });
});

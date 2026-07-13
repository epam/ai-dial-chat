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

  it('protects encoded resource data from router decoding', () => {
    expect(
      getConversationRoute(
        'tenant/applications/catalog/Team%2FApp%20One__0.0.1__title',
      ),
    ).toBe(
      '/conversations/tenant/applications/catalog/Team%252FApp%2520One__0.0.1__title',
    );
  });

  it('falls back to root when a segment is a parent-directory traversal', () => {
    expect(getConversationRoute('tenant/../../evil')).toBe('/');
  });

  it('falls back to root when a segment is the current-directory dot', () => {
    expect(getConversationRoute('tenant/./path')).toBe('/');
  });

  it('falls back to root when a segment is empty (double slash)', () => {
    expect(getConversationRoute('tenant//path')).toBe('/');
  });
});

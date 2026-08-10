import { describe, expect, it } from 'vitest';
import {
  getConversationRoute,
  getScheduledTaskDetailRoute,
  getScheduledTaskEditRoute,
  normalizeConversationId,
} from '../routes';

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

  /*
   * The backend concatenates a Quick App's (possibly percent-encoded)
   * deployment id directly into the conversation id. Each URL segment is
   * decoded first (undoing any pre-existing encoding) before being
   * re-encoded exactly once, so the router's single automatic decode on
   * navigation lands back on the fully raw, correctly single-encoded value
   * — not a double-encoded one.
   */
  it('decodes an already-percent-encoded segment before re-encoding it once', () => {
    expect(
      getConversationRoute(
        'tenant/applications/catalog/Team%2FApp%20One__0.0.1__title',
      ),
    ).toBe(
      '/conversations/tenant/applications/catalog/Team%2FApp%20One__0.0.1__title',
    );
  });

  it('leaves a literal, non-percent-encoding "%" in a segment unchanged when decoding fails', () => {
    expect(getConversationRoute('tenant/gpt-4o__50% off__title')).toBe(
      '/conversations/tenant/gpt-4o__50%25%20off__title',
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

describe('getScheduledTaskDetailRoute', () => {
  it('builds the detail route for a plain scheduleId', () => {
    expect(getScheduledTaskDetailRoute('sched_123')).toBe(
      '/scheduled-tasks/sched_123',
    );
  });

  it('percent-encodes a scheduleId that needs encoding', () => {
    expect(getScheduledTaskDetailRoute('sched 123/x')).toBe(
      '/scheduled-tasks/sched%20123%2Fx',
    );
  });
});

describe('getScheduledTaskEditRoute', () => {
  it('builds the edit route for a plain scheduleId', () => {
    expect(getScheduledTaskEditRoute('sched_123')).toBe(
      '/scheduled-tasks/sched_123/edit',
    );
  });

  it('percent-encodes a scheduleId that needs encoding', () => {
    expect(getScheduledTaskEditRoute('sched 123/x')).toBe(
      '/scheduled-tasks/sched%20123%2Fx/edit',
    );
  });
});

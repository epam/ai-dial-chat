import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConversationDraftStore } from '../useConversationDraftStore';

const userState = vi.hoisted(() => ({
  user: null as { sub: string } | null,
  isDraftsEnabled: true,
}));

vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({ user: userState.user }),
}));
vi.mock('../../useUiFeature', () => ({
  useUiFeature: (feature: string) =>
    feature === 'conversation-drafts' && userState.isDraftsEnabled,
}));

const draft = { text: 'hello', skills: [], updatedAt: 1 };

describe('useConversationDraftStore', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    userState.user = { sub: 'alice' };
    userState.isDraftsEnabled = true;
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('writes under a user-scoped sessionStorage key', () => {
    const { result } = renderHook(() => useConversationDraftStore());
    result.current?.write('conversations/bucket/a', draft);

    expect(
      window.sessionStorage.getItem('conversationDrafts:alice'),
    ).toBeTruthy();
    expect(result.current?.read('/conversations/bucket/a')?.text).toBe('hello');
    expect(result.current?.read('bucket/a')?.text).toBe('hello');
  });

  it('keeps another user from reading the drafts', () => {
    const { result, rerender } = renderHook(() => useConversationDraftStore());
    result.current?.write('bucket/a', draft);
    userState.user = { sub: 'bob' };
    rerender();

    expect(result.current?.read('bucket/a')).toBeUndefined();
  });

  it('returns undefined without a signed-in user', () => {
    userState.user = null;
    const { result } = renderHook(() => useConversationDraftStore());

    expect(result.current).toBeUndefined();
  });

  it('returns undefined and discards stored drafts when the conversation-drafts feature is off', () => {
    window.sessionStorage.setItem(
      'conversationDrafts:alice',
      JSON.stringify({
        version: 1,
        drafts: { 'bucket/a': draft },
      }),
    );
    userState.isDraftsEnabled = false;
    const { result } = renderHook(() => useConversationDraftStore());

    expect(result.current).toBeUndefined();
    expect(
      window.sessionStorage.getItem('conversationDrafts:alice'),
    ).toBeNull();
  });

  it('returns the same instance across rerenders for the same user', () => {
    const { result, rerender } = renderHook(() => useConversationDraftStore());
    const first = result.current;
    userState.user = { sub: 'alice' };
    rerender();

    expect(result.current).toBe(first);
  });
});

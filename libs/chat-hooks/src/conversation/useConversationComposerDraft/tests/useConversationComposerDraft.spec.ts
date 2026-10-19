import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ConversationDraft,
  ConversationDraftStore,
} from '../../conversation-draft/conversation-draft';
import { createMemoryConversationDraftStore } from '../../conversation-draft/conversation-draft-store';
import {
  useConversationComposerDraft,
  type UseConversationComposerDraftParams,
} from '../useConversationComposerDraft';

const stored = (text: string): ConversationDraft => ({
  text,
  skills: [],
  updatedAt: 1,
});

describe('useConversationComposerDraft', () => {
  let store: ConversationDraftStore;
  let restoreDraft: ReturnType<
    typeof vi.fn<(draft: ConversationDraft) => void>
  >;

  beforeEach(() => {
    vi.useFakeTimers();
    store = createMemoryConversationDraftStore();
    restoreDraft = vi.fn<(draft: ConversationDraft) => void>();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderDraft = (
    props: Partial<UseConversationComposerDraftParams> = {},
  ) =>
    renderHook(
      (params: Partial<UseConversationComposerDraftParams>) =>
        useConversationComposerDraft({
          store,
          conversationId: 'a',
          restoreDraft,
          ...params,
        }),
      { initialProps: props },
    );

  it('flushes a pending write on unmount and restores it on remount', () => {
    const view = renderDraft();
    act(() => view.result.current.handleTextChange('compare these two plans'));
    act(() => vi.advanceTimersByTime(100));
    view.unmount();

    expect(store.read('a')?.text).toBe('compare these two plans');

    renderDraft();
    expect(restoreDraft).toHaveBeenCalledOnce();
    expect(restoreDraft).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'compare these two plans' }),
    );
  });

  it('keeps a separate draft per conversation across id changes', () => {
    const { result, rerender } = renderDraft({ conversationId: 'a' });
    act(() => result.current.handleTextChange('draft A'));
    rerender({ conversationId: 'b' });
    act(() => result.current.handleTextChange('draft B'));
    rerender({ conversationId: 'a' });

    expect(restoreDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: 'draft A' }),
    );
    expect(store.read('b')?.text).toBe('draft B');
  });

  it('restores an empty draft when the new id has nothing stored', () => {
    const { rerender } = renderDraft({ conversationId: 'a' });
    expect(restoreDraft).not.toHaveBeenCalled();
    rerender({ conversationId: 'b' });
    expect(restoreDraft).toHaveBeenCalledWith({
      text: '',
      skills: [],
      updatedAt: 0,
    });
  });

  it('defers the restore until isRestoreReady becomes true', () => {
    store.write('a', stored('saved'));
    const { rerender } = renderDraft({ isRestoreReady: false });
    expect(restoreDraft).not.toHaveBeenCalled();

    rerender({ isRestoreReady: true });
    rerender({ isRestoreReady: true });
    expect(restoreDraft).toHaveBeenCalledOnce();
    expect(restoreDraft).toHaveBeenCalledWith(stored('saved'));
  });

  it('skips a late restore when the user typed before readiness', () => {
    store.write('a', stored('saved'));
    const { result, rerender } = renderDraft({ isRestoreReady: false });
    act(() => result.current.handleTextChange('new'));
    rerender({ isRestoreReady: true });
    act(() => vi.runAllTimers());

    expect(restoreDraft).not.toHaveBeenCalled();
    expect(store.read('a')?.text).toBe('new');
  });

  it('lets external content win over a stored draft', () => {
    store.write('a', {
      text: 'old',
      skills: [{ url: 'skills/b/x' }],
      updatedAt: 1,
    });
    const { result } = renderDraft({ shouldSkipRestore: true });
    act(() => result.current.handleExternalContent('from host'));
    act(() => vi.runAllTimers());

    expect(restoreDraft).not.toHaveBeenCalled();
    expect(store.read('a')).toMatchObject({ text: 'from host', skills: [] });
  });

  it('removes the draft when the send resolves', async () => {
    const { result } = renderDraft();
    act(() => result.current.handleTextChange('hello'));
    await act(() =>
      result.current.sendWithDraft('hello', () => Promise.resolve()),
    );
    act(() => vi.runAllTimers());

    expect(store.read('a')).toBeUndefined();
  });

  it('does not re-create the entry when skills reset after a successful send', async () => {
    const { result } = renderDraft();
    act(() => result.current.handleSkillsChange([{ url: 'skills/b/x' }]));
    act(() => result.current.handleTextChange('hello'));
    await act(() =>
      result.current.sendWithDraft('hello', () => Promise.resolve()),
    );
    act(() => result.current.handleSkillsChange([]));
    act(() => vi.runAllTimers());

    expect(store.read('a')).toBeUndefined();
  });

  it('keeps the text typed while a send is in flight', async () => {
    const { result } = renderDraft();
    act(() => result.current.handleTextChange('hello'));
    let finishSend: () => void = () => undefined;
    let sending: Promise<void> = Promise.resolve();
    act(() => {
      sending = result.current.sendWithDraft(
        'hello',
        () => new Promise<void>((resolve) => (finishSend = resolve)),
      );
    });
    act(() => result.current.handleTextChange('next question'));
    act(() => vi.runAllTimers());

    await act(async () => {
      finishSend();
      await sending;
    });

    expect(store.read('a')?.text).toBe('next question');
  });

  it('keeps the draft and rethrows when the send rejects', async () => {
    const { result } = renderDraft();
    act(() => result.current.handleTextChange('hello'));
    const failure = new Error('network');

    await expect(
      act(() =>
        result.current.sendWithDraft('hello', async () => {
          throw failure;
        }),
      ),
    ).rejects.toBe(failure);
    expect(store.read('a')?.text).toBe('hello');
  });

  it('removes the draft once the input is emptied', () => {
    store.write('a', stored('saved'));
    const { result } = renderDraft();
    act(() => result.current.handleTextChange(''));
    act(() => vi.advanceTimersByTime(300));

    expect(store.read('a')).toBeUndefined();
  });

  it('flushes a pending write on pagehide', () => {
    const { result } = renderDraft();
    act(() => result.current.handleTextChange('before reload'));
    expect(store.read('a')).toBeUndefined();

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(store.read('a')?.text).toBe('before reload');
  });

  it('writes nothing for a conversation the user never touched', () => {
    const write = vi.spyOn(store, 'write');
    const { rerender, unmount } = renderDraft({ conversationId: 'a' });
    rerender({ conversationId: 'b' });
    unmount();

    expect(write).not.toHaveBeenCalled();
  });

  it('does nothing without a store', async () => {
    const send = vi.fn(() => Promise.resolve());
    const { result, unmount } = renderDraft({ store: undefined });
    act(() => result.current.handleTextChange('hello'));
    await act(() => result.current.sendWithDraft('hello', send));
    unmount();

    expect(send).toHaveBeenCalledOnce();
    expect(restoreDraft).not.toHaveBeenCalled();
    expect(store.read('a')).toBeUndefined();
  });

  it('keeps handler identities stable across rerenders', () => {
    const { result, rerender } = renderDraft();
    const first = result.current;
    rerender({ restoreDraft: vi.fn(), isRestoreReady: true, debounceMs: 10 });

    expect(result.current.handleTextChange).toBe(first.handleTextChange);
    expect(result.current.handleSkillsChange).toBe(first.handleSkillsChange);
    expect(result.current.handleExternalContent).toBe(
      first.handleExternalContent,
    );
    expect(result.current.sendWithDraft).toBe(first.sendWithDraft);
    expect(result.current.clearDraft).toBe(first.clearDraft);
  });
});

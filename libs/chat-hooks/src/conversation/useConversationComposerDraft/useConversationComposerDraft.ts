import type { RequestSkill } from '@epam/ai-dial-chat-shared';
import { useCallback, useEffect, useRef } from 'react';
import type {
  ConversationDraft,
  ConversationDraftStore,
} from '../conversation-draft/conversation-draft';

const DEFAULT_DEBOUNCE_MS = 300;

const EMPTY_DRAFT: ConversationDraft = { text: '', skills: [], updatedAt: 0 };

/** Parameters of `useConversationComposerDraft`. */
export interface UseConversationComposerDraftParams {
  /** Host-owned draft store; `undefined` (e.g. no signed-in user yet) makes every handler a no-op. */
  store: ConversationDraftStore | undefined;
  /** The conversation whose draft is managed. */
  conversationId: string;
  /** Seeds the host's own composer and mention state from a restored draft. */
  restoreDraft: (draft: ConversationDraft) => void;
  /** While `false` the restore is deferred. Defaults to `true`. */
  isRestoreReady?: boolean;
  /** Skips the restore for this conversation, e.g. when external content is pending. Defaults to `false`. */
  shouldSkipRestore?: boolean;
  /** Delay before a change is written to the store, in milliseconds. Defaults to `300`. */
  debounceMs?: number;
}

/** Stable handlers returned by `useConversationComposerDraft`. */
export interface UseConversationComposerDraftResult {
  /** Records a user-driven text change and schedules a save. */
  handleTextChange: (text: string) => void;
  /** Records the current skill mentions and schedules a save when they changed. */
  handleSkillsChange: (skills: RequestSkill[]) => void;
  /** Replaces the draft with host-provided content and no skills, and schedules a save. */
  handleExternalContent: (text: string) => void;
  /** Runs `send`, removing the draft when it resolves unless the user edited meanwhile, and storing `text` again when it rejects (the rejection is rethrown). */
  sendWithDraft: (
    text: string,
    send: () => Promise<unknown> | unknown,
  ) => Promise<void>;
  /** Discards the draft for the current conversation. */
  clearDraft: () => void;
}

interface DraftState {
  conversationId: string;
  text: string;
  skills: RequestSkill[];
  hasUserInput: boolean;
  isRestored: boolean;
  isSendingCleared: boolean;
  /** Bumped on every recorded edit, so a send can tell whether the user typed meanwhile. */
  editRevision: number;
}

interface PendingWrite {
  handle: ReturnType<typeof setTimeout>;
  run: () => void;
}

const createDraftState = (conversationId: string): DraftState => ({
  conversationId,
  text: '',
  skills: [],
  hasUserInput: false,
  isRestored: false,
  isSendingCleared: false,
  editRevision: 0,
});

const areSkillsEqual = (a: RequestSkill[], b: RequestSkill[]): boolean =>
  a.length === b.length &&
  a.every((skill, index) => skill.url === b[index].url);

/**
 * Headless per-conversation composer draft: saves the text and skill mentions
 * the user leaves behind, restores them once when the conversation is shown
 * again, and discards them on a successful send or an emptied input.
 *
 * All state lives in refs, so the hook never re-renders the host.
 */
export const useConversationComposerDraft = ({
  store,
  conversationId,
  restoreDraft,
  isRestoreReady = true,
  shouldSkipRestore = false,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseConversationComposerDraftParams): UseConversationComposerDraftResult => {
  const stateRef = useRef<DraftState | null>(null);
  const hasPreviousConversationRef = useRef(false);
  const pendingRef = useRef<PendingWrite | null>(null);
  const restoreDraftRef = useRef(restoreDraft);
  const debounceMsRef = useRef(debounceMs);
  restoreDraftRef.current = restoreDraft;
  debounceMsRef.current = debounceMs;

  /* Per-conversation state is replaced lazily the first time a new id is seen. */
  const getState = useCallback((id: string): DraftState => {
    const current = stateRef.current;
    if (current?.conversationId === id) return current;
    if (current) hasPreviousConversationRef.current = true;
    const next = createDraftState(id);
    stateRef.current = next;
    return next;
  }, []);

  const cancelPending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.handle);
    pendingRef.current = null;
  }, []);

  const flushPending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.handle);
    pending.run();
  }, []);

  const scheduleWrite = useCallback(
    (targetStore: ConversationDraftStore, state: DraftState) => {
      cancelPending();
      const run = () => {
        pendingRef.current = null;
        targetStore.write(state.conversationId, {
          text: state.text,
          skills: state.skills,
          updatedAt: Date.now(),
        });
      };
      pendingRef.current = {
        handle: setTimeout(run, debounceMsRef.current),
        run,
      };
    },
    [cancelPending],
  );

  /* Flushes a pending write under the id it was made for, on id/store change and on unmount. */
  useEffect(() => flushPending, [store, conversationId, flushPending]);

  useEffect(() => {
    window.addEventListener('pagehide', flushPending);
    return () => window.removeEventListener('pagehide', flushPending);
  }, [flushPending]);

  useEffect(() => {
    const state = getState(conversationId);
    if (state.isRestored) return;
    if (shouldSkipRestore) {
      state.isRestored = true;
      return;
    }
    if (!isRestoreReady || !store) return;
    state.isRestored = true;
    if (state.hasUserInput) return;

    const stored = store.read(conversationId);
    if (stored) {
      state.text = stored.text;
      state.skills = stored.skills;
      restoreDraftRef.current(stored);
      return;
    }
    // No draft: a host whose view stayed mounted across the id change resets its seed.
    if (hasPreviousConversationRef.current) {
      restoreDraftRef.current(EMPTY_DRAFT);
    }
  }, [store, conversationId, isRestoreReady, shouldSkipRestore, getState]);

  const handleTextChange = useCallback(
    (text: string) => {
      const state = getState(conversationId);
      state.text = text;
      state.hasUserInput = true;
      state.editRevision += 1;
      state.isSendingCleared = false;
      if (store) scheduleWrite(store, state);
    },
    [store, conversationId, getState, scheduleWrite],
  );

  const handleSkillsChange = useCallback(
    (skills: RequestSkill[]) => {
      const state = getState(conversationId);
      if (areSkillsEqual(state.skills, skills)) return;
      state.skills = skills;
      // A skill reset right after a successful send must not re-create the entry.
      if (state.isSendingCleared && state.text === '') return;
      state.hasUserInput = true;
      state.editRevision += 1;
      if (store) scheduleWrite(store, state);
    },
    [store, conversationId, getState, scheduleWrite],
  );

  const handleExternalContent = useCallback(
    (text: string) => {
      const state = getState(conversationId);
      state.text = text;
      state.skills = [];
      state.hasUserInput = true;
      state.editRevision += 1;
      state.isSendingCleared = false;
      if (store) scheduleWrite(store, state);
    },
    [store, conversationId, getState, scheduleWrite],
  );

  const sendWithDraft = useCallback(
    async (text: string, send: () => Promise<unknown> | unknown) => {
      if (!store) {
        await send();
        return;
      }
      const state = getState(conversationId);
      cancelPending();
      state.text = '';
      state.isSendingCleared = true;
      const sendRevision = state.editRevision;
      try {
        await send();
      } catch (error) {
        /*
         * The composer puts the failed message back in place of anything typed
         * meanwhile, so the draft follows it. The write is explicit because
         * cancelPending dropped the save that was still waiting.
         */
        state.text = text;
        state.isSendingCleared = false;
        store.write(conversationId, {
          text,
          skills: state.skills,
          updatedAt: Date.now(),
        });
        throw error;
      }
      /* Text typed while `send` was in flight is the next draft; keep it. */
      if (state.editRevision === sendRevision) store.remove(conversationId);
    },
    [store, conversationId, getState, cancelPending],
  );

  const clearDraft = useCallback(() => {
    const state = getState(conversationId);
    cancelPending();
    state.text = '';
    state.skills = [];
    store?.remove(conversationId);
  }, [store, conversationId, getState, cancelPending]);

  return {
    handleTextChange,
    handleSkillsChange,
    handleExternalContent,
    sendWithDraft,
    clearDraft,
  };
};

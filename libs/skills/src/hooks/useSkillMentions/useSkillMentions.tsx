import type { RequestSkill } from '@epam/ai-dial-chat-shared';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { SkillMentionAnchor } from '../../models/skill-mention-anchor';
import { matchSkillMentions } from '../../utils/skill-mention-matching';
import {
  diffTextChange,
  findMentionAtCaret,
  insertAnchor,
  reconcileAnchors,
  type TextChange,
} from '../../utils/skill-mention-tracking';

/** Return value of {@link useSkillMentions}. */
export interface UseSkillMentionsResult {
  /** The current plain-text draft, mentions included as literal `/{name}` runs. */
  draft: string;
  /** Ordered, left-to-right tracked mention locations within `draft`. */
  anchors: SkillMentionAnchor[];
  /** Reconciles `anchors` against an external edit to the draft (typing, deleting, pasting, undo/redo). */
  onDraftChange: (nextValue: string) => void;
  /**
   * Splices `/${name}` into the draft at `atCaretIndex` and tracks it as a
   * new mention, appending a trailing space only when `atCaretIndex` isn't
   * already followed by whitespace (typed at the end of the message, or
   * before a non-space character) — text already followed by a space (a
   * mention inserted between two existing words) gets none, so a second
   * space is never introduced. Returns whether a space was appended, so the
   * caller can place the caret right after whichever run was actually
   * inserted.
   */
  insertMention: (url: string, name: string, atCaretIndex: number) => boolean;
  /** Splices `/${name}` back into the draft at `atIndex` and re-tracks it as a mention, with no trailing-space logic — for restoring an exact previous mention, not inserting a new one. */
  restoreMention: (url: string, name: string, atIndex: number) => void;
  /**
   * Looks up the mention whose run ends exactly at `caretPosition`, without
   * mutating `draft`/`anchors`. The caller (`Input.tsx`) uses the returned
   * anchor's range to delete the whole run through the textarea's native
   * editing pipeline (e.g. `setRangeText`), preserving native undo, then
   * reports the result back through `onDraftChange` — whose own
   * overlap-drop reconciliation removes the anchor. Returns `undefined` when
   * the caret isn't at a mention boundary, so the caller falls back to the
   * browser's default single-character deletion.
   */
  onBackspaceAtCaret: (caretPosition: number) => SkillMentionAnchor | undefined;
  /** `anchors` as an ordered `RequestSkill[]`, or `undefined` when there are no mentions — the `custom_content.skills` payload. */
  orderedSkills: RequestSkill[] | undefined;
  /** Clears both the draft and its tracked mentions. */
  reset: () => void;
  /**
   * Initializes the draft and its tracked mentions from a persisted message —
   * runs {@link matchSkillMentions} once against `text`/`skills` and seeds
   * `anchors` from the result. A skill the match could not locate in `text` is
   * not seeded as an anchor.
   */
  seedFromMessage: (
    text: string,
    skills: RequestSkill[] | undefined,
    resolveName: (url: string) => string,
  ) => void;
}

/**
 * Tracks an ordered set of skill mentions live within a plain-text draft, as
 * character-range anchors, replacing a single `selectedSkillId` selection.
 */
export const useSkillMentions = (): UseSkillMentionsResult => {
  const [draft, setDraft] = useState('');
  const [anchors, setAnchors] = useState<SkillMentionAnchor[]>([]);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const anchorsRef = useRef(anchors);
  anchorsRef.current = anchors;

  const onDraftChange = useCallback((nextValue: string) => {
    const change: TextChange = diffTextChange(draftRef.current, nextValue);
    setAnchors((prevAnchors) => reconcileAnchors(prevAnchors, change));
    /*
     * Updated synchronously (not only through the render-time `draftRef.current
     * = draft` assignment above) so `insertMention`, called immediately after
     * this in the same event handler — e.g. the command menu's `close({
     * consumeQuery: true })` followed by the actual selection — reads the
     * post-edit draft rather than a stale pre-render value.
     */
    draftRef.current = nextValue;
    setDraft(nextValue);
  }, []);

  const insertMention = useCallback(
    (url: string, name: string, atCaretIndex: number): boolean => {
      const prevDraft = draftRef.current;
      const hasTrailingSpace = /^\s/.test(prevDraft.slice(atCaretIndex));
      const addsTrailingSpace = !hasTrailingSpace;
      const insertedText = `/${name}${addsTrailingSpace ? ' ' : ''}`;
      const nextDraft =
        prevDraft.slice(0, atCaretIndex) +
        insertedText +
        prevDraft.slice(atCaretIndex);

      draftRef.current = nextDraft;
      setDraft(nextDraft);
      setAnchors((prevAnchors) =>
        insertAnchor(prevAnchors, atCaretIndex, url, name, addsTrailingSpace),
      );

      return addsTrailingSpace;
    },
    [],
  );

  /* Re-inserts a mention removed to open "Use skill" after a canceled browse — see the skill-input-attachment spec's "Slash command dropdown" requirement. */
  const restoreMention = useCallback(
    (url: string, name: string, atIndex: number) => {
      const prevDraft = draftRef.current;
      const text = `/${name}`;
      const nextDraft =
        prevDraft.slice(0, atIndex) + text + prevDraft.slice(atIndex);

      draftRef.current = nextDraft;
      setDraft(nextDraft);
      /* No trailing space to account for: it was never removed, so `insertAnchor`'s shift covers just `text.length`. */
      setAnchors((prevAnchors) =>
        insertAnchor(prevAnchors, atIndex, url, name, false),
      );
    },
    [],
  );

  const onBackspaceAtCaret = useCallback(
    (caretPosition: number): SkillMentionAnchor | undefined =>
      findMentionAtCaret(anchorsRef.current, caretPosition),
    [],
  );

  const orderedSkills = useMemo<RequestSkill[] | undefined>(() => {
    if (anchors.length === 0) return undefined;

    return anchors.map((anchor) => ({ url: anchor.url }));
  }, [anchors]);

  const reset = useCallback(() => {
    setDraft('');
    setAnchors([]);
  }, []);

  const seedFromMessage = useCallback(
    (
      text: string,
      skills: RequestSkill[] | undefined,
      resolveName: (url: string) => string,
    ) => {
      const resolvedSkills = skills ?? [];
      const resolvedMentions = matchSkillMentions(
        text,
        resolvedSkills,
        resolveName,
      );

      setDraft(text);
      setAnchors(
        resolvedMentions.map((mention) => {
          const skill = resolvedSkills[mention.skillIndex];
          return {
            url: skill.url,
            name: resolveName(skill.url),
            start: mention.start,
            length: mention.length,
          };
        }),
      );
    },
    [],
  );

  /* Memoized so callers keying effects/callbacks on the whole result get a stable reference — see [#9109](https://github.com/epam/ai-dial-chat/issues/9109). */
  return useMemo(
    () => ({
      draft,
      anchors,
      onDraftChange,
      insertMention,
      restoreMention,
      onBackspaceAtCaret,
      orderedSkills,
      reset,
      seedFromMessage,
    }),
    [
      draft,
      anchors,
      onDraftChange,
      insertMention,
      restoreMention,
      onBackspaceAtCaret,
      orderedSkills,
      reset,
      seedFromMessage,
    ],
  );
};

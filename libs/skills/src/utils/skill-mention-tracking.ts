import type { SkillMentionAnchor } from '../models/skill-mention-anchor';

/** A single-region text edit, expressed as the replaced range in the previous string. */
export interface TextChange {
  /** Character offset where the previous and next strings first diverge. */
  start: number;
  /** Number of characters removed from the previous string at `start`. */
  deletedLength: number;
  /** Number of characters inserted at `start` in the next string. */
  insertedLength: number;
}

/**
 * Diffs two strings produced by a single-cursor edit (typing, deleting,
 * pasting, cutting, undo/redo) via their common prefix and common suffix —
 * cheap (O(n)) and exact for that class of edit, which is everything a
 * textarea actually produces.
 */
export const diffTextChange = (previous: string, next: string): TextChange => {
  const maxPrefix = Math.min(previous.length, next.length);
  let prefixLength = 0;
  while (
    prefixLength < maxPrefix &&
    previous[prefixLength] === next[prefixLength]
  ) {
    prefixLength += 1;
  }

  const maxSuffix = maxPrefix - prefixLength;
  let suffixLength = 0;
  while (
    suffixLength < maxSuffix &&
    previous[previous.length - 1 - suffixLength] ===
      next[next.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  return {
    start: prefixLength,
    deletedLength: previous.length - prefixLength - suffixLength,
    insertedLength: next.length - prefixLength - suffixLength,
  };
};

/**
 * Applies a text change to a set of tracked mention anchors: an anchor
 * entirely before the edited region is untouched, one entirely after is
 * shifted by the edit's length delta, and one that overlaps the edited region
 * is dropped — the user edited into the middle of a mention, so it reverts to
 * plain text and no longer contributes a `custom_content.skills` entry.
 */
export const reconcileAnchors = (
  anchors: SkillMentionAnchor[],
  change: TextChange,
): SkillMentionAnchor[] => {
  const editEnd = change.start + change.deletedLength;
  const delta = change.insertedLength - change.deletedLength;

  return anchors.reduce<SkillMentionAnchor[]>((reconciled, anchor) => {
    const anchorEnd = anchor.start + anchor.length;

    if (anchorEnd <= change.start) {
      reconciled.push(anchor);
      return reconciled;
    }

    if (anchor.start >= editEnd) {
      reconciled.push({ ...anchor, start: anchor.start + delta });
      return reconciled;
    }

    return reconciled;
  }, []);
};

/**
 * Inserts a new mention anchor at `atIndex` and shifts every anchor at or
 * after that index by the inserted `/{name}` run's length — plus one more
 * when `hasTrailingSpace` — keeping the result ordered by `start`
 * (left-to-right reading order).
 */
export const insertAnchor = (
  anchors: SkillMentionAnchor[],
  atIndex: number,
  url: string,
  name: string,
  hasTrailingSpace: boolean,
): SkillMentionAnchor[] => {
  const mentionLength = name.length + 1; // '/' + name
  const insertedTextLength = mentionLength + (hasTrailingSpace ? 1 : 0);

  const shifted = anchors.map((anchor) =>
    anchor.start >= atIndex
      ? { ...anchor, start: anchor.start + insertedTextLength }
      : anchor,
  );

  const newAnchor: SkillMentionAnchor = {
    url,
    name,
    start: atIndex,
    length: mentionLength,
  };

  return [...shifted, newAnchor].sort((a, b) => a.start - b.start);
};

/**
 * Finds the anchor whose mention run ends exactly at `caretPosition` — the
 * caret sitting immediately after that mention — or `undefined` if none does.
 * Used to detect the whole-mention Backspace gesture.
 */
export const findMentionAtCaret = (
  anchors: SkillMentionAnchor[],
  caretPosition: number,
): SkillMentionAnchor | undefined =>
  anchors.find((anchor) => anchor.start + anchor.length === caretPosition);

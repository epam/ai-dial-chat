import type { ReactNode } from 'react';
import type { HighlightedTextRange } from '../models/Input';

/*
 * A zero-width or content-bearing node spliced into a plain-text run of the
 * highlight mirror at a given character `offset`, with no effect on the
 * surrounding text or its wrapping.
 */
export interface MirrorInsertion {
  offset: number;
  /** A React element carrying its own `key`. */
  node: ReactNode;
}

/*
 * Splits `text` into an ordered array of plain-text runs, highlighted spans
 * for each range in `ranges` (sorted defensively, since callers track
 * anchors in insertion order rather than left-to-right order), and any
 * `insertions` (sorted by offset here, since the marker and the hint are
 * computed independently by the caller). Renders into the highlight mirror
 * underneath the real textarea, so it must reproduce `text` exactly,
 * character for character — no trimming, no collapsing of adjacent runs
 * beyond what plain string slicing already does.
 *
 * Every insertion offset is assumed to fall inside a plain-text run, never
 * inside a highlighted range (a tracked mention is already-selected text;
 * the menu only ever tracks an in-progress, unselected trigger word) — if
 * that assumption is ever violated, the insertion is simply skipped rather
 * than corrupting a highlighted run.
 *
 * Everything here duplicates text the real (transparent-colored) textarea
 * already carries, so every plain-text run and the default highlight span
 * are marked `aria-hidden` individually (the mirror as a whole is no longer
 * blanket-`aria-hidden`, since a range with `render` supplies genuinely new,
 * non-duplicated content — see `HighlightedTextRange.render`'s doc). A
 * `render`-backed range is deliberately left both un-hidden and
 * `pointer-events-auto`, overriding the mirror's own `pointer-events-none`,
 * so it behaves as real interactive content rather than a visual duplicate.
 */
export const renderHighlightedText = (
  text: string,
  ranges: HighlightedTextRange[],
  insertions: MirrorInsertion[],
  mentionHighlightClassName: string,
  mentionHighlightUnsupportedClassName: string,
): ReactNode[] => {
  const sortedRanges = [...ranges].sort((a, b) => a.start - b.start);
  const sortedInsertions = [...insertions].sort((a, b) => a.offset - b.offset);
  const segments: ReactNode[] = [];
  let cursor = 0;
  let plainRunIndex = 0;

  const pushText = (from: number, to: number) => {
    if (to <= from) return;
    let inner = from;
    sortedInsertions
      .filter((insertion) => insertion.offset >= from && insertion.offset <= to)
      .forEach((insertion) => {
        if (insertion.offset > inner) {
          segments.push(
            <span key={`text-${plainRunIndex++}`} aria-hidden>
              {text.slice(inner, insertion.offset)}
            </span>,
          );
        }
        segments.push(insertion.node);
        inner = insertion.offset;
      });
    if (inner < to) {
      segments.push(
        <span key={`text-${plainRunIndex++}`} aria-hidden>
          {text.slice(inner, to)}
        </span>,
      );
    }
  };

  sortedRanges.forEach((range, index) => {
    pushText(cursor, range.start);
    const rangeText = text.slice(range.start, range.start + range.length);
    segments.push(
      range.render ? (
        <span key={`range-${index}`} className="pointer-events-auto">
          {range.render()}
        </span>
      ) : (
        <span
          key={`range-${index}`}
          aria-hidden
          className={
            range.isUnsupported
              ? mentionHighlightUnsupportedClassName
              : mentionHighlightClassName
          }
        >
          {rangeText}
        </span>
      ),
    );
    cursor = range.start + range.length;
  });

  pushText(cursor, text.length);

  return segments;
};

/*
 * Finds the (text node, offset-within-node) pair in the highlight mirror's
 * own DOM that corresponds to `targetOffset` characters into `message`, by
 * walking the mirror's text nodes in document order and accumulating their
 * lengths. Skips any text node nested under a `data-mirror-synthetic`
 * ancestor — the command menu's empty-query hint is real DOM text spliced
 * into the mirror's flow for correct font metrics (see `mirrorInsertions`),
 * but it isn't part of `message` and must not shift this offset mapping for
 * anything after it. Returns `null` once `targetOffset` runs past the
 * mirror's own text (should not happen: `message`'s length always equals
 * the walked text nodes' combined length precisely because the mirror
 * mirrors `message` character-for-character).
 */
const locateMirrorOffset = (
  root: HTMLElement,
  targetOffset: number,
): { node: Node; offset: number } | null => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest('[data-mirror-synthetic]') != null
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });

  let consumed = 0;
  for (let node = walker.nextNode(); node != null; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0;
    if (targetOffset <= consumed + length) {
      return { node, offset: targetOffset - consumed };
    }
    consumed += length;
  }
  return null;
};

/**
 * A DOM `Range` spanning `[start, end)` characters of `message` within the
 * highlight mirror, or `null` when either boundary can't be located (see
 * `locateMirrorOffset`). Used to read the exact, wrap-aware pixel rectangles
 * of the current native text selection via `Range.getClientRects()`, rather
 * than re-deriving line-wrapping by hand.
 */
export const buildMirrorSelectionRange = (
  root: HTMLElement,
  start: number,
  end: number,
): Range | null => {
  const startLocation = locateMirrorOffset(root, start);
  const endLocation = locateMirrorOffset(root, end);
  if (startLocation == null || endLocation == null) return null;

  const range = document.createRange();
  range.setStart(startLocation.node, startLocation.offset);
  range.setEnd(endLocation.node, endLocation.offset);
  return range;
};

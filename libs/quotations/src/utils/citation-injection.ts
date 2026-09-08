import type { TextCharacterRangeSelector } from '@epam/ai-dial-chat-shared';
import type { ReactNode } from 'react';
import type { AnnotationGroup } from './group-annotations-by-source';

/**
 * Sentinel pattern used to mark citation insertion points inside the raw
 * markdown string. Uses Unicode characters unlikely to appear in LLM output.
 *
 * Format: ⟦C{idx}⟧  where idx is the zero-based AnnotationGroup index.
 */
const SENTINEL_RE = /⟦C(\d+)⟧/g;

/**
 * Inserts sentinel strings into `content` at the `end` character offsets of
 * each non-`html_tag` annotation group's primary selector (descending order
 * so earlier insertions don't shift later ones). Sentinel indices are the
 * group's position in the original flat `groups` array, so a caller doing
 * `groups[idx]` still resolves correctly even though `html_tag` groups are
 * skipped here — those render as real `<cit>` elements instead (see
 * `useCitationMarkdownComponents`'s `cit` component override).
 */
export const injectCitationSentinels = (
  content: string,
  groups: AnnotationGroup[],
): string => {
  const positions = groups
    .map((g, idx) => ({ g, idx }))
    .filter(
      ({ g }) => g.primaryAnnotation.target?.selector?.type !== 'html_tag',
    )
    .map(({ g, idx }) => {
      const selector = g.primaryAnnotation.target?.selector;
      const end =
        selector != null &&
        typeof selector === 'object' &&
        'type' in selector &&
        selector.type === 'text_character_range'
          ? (selector as TextCharacterRangeSelector).end
          : content.length;
      return { idx, pos: Math.min(end, content.length) };
    })
    .sort((a, b) => b.pos - a.pos);

  let result = content;
  for (const { idx, pos } of positions) {
    result = `${result.slice(0, pos)}⟦C${idx}⟧${result.slice(pos)}`;
  }
  return result;
};

/** Matches the only markup shape interpreted as a citation element. */
const CIT_ELEMENT_RE = /<cit\s+data-id=(?:"[^"]+"|'[^']+')\s*>\s*<\/cit>/g;

const EXACT_CIT_ELEMENT_RE =
  /^<cit\s+data-id=(?:"[^"]+"|'[^']+')\s*>\s*<\/cit>$/;

/*
 * Matches either the supported paired citation element (first alternative)
 * or an individual/partial cit tag. Ordering matters: a supported pair must
 * be consumed as one match before the individual-tag alternatives see it.
 */
const CIT_MARKUP_RE =
  /<cit\s+data-id=(?:"[^"]+"|'[^']+')\s*>\s*<\/cit>|<\/?cit\b[^>]*>|<\/?cit\b[^>]*$/gi;

const escapeHtmlMarkup = (markup: string): string =>
  markup.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Leaves the one supported paired citation element parseable as HTML and
 * escapes every other `cit` shape so Markdown renders the original markup as
 * visible text. Unsupported markup is never interpreted as a citation.
 */
export const escapeUnsupportedCitTags = (content: string): string =>
  content.replace(CIT_MARKUP_RE, (markup) =>
    EXACT_CIT_ELEMENT_RE.test(markup) ? markup : escapeHtmlMarkup(markup),
  );

/**
 * Hides supported paired citation elements while the message is streaming.
 * Every other `cit` shape is escaped and remains visible as ordinary text,
 * preventing an incomplete opening tag from swallowing the streamed suffix.
 */
export const stripCitTagsWhileStreaming = (content: string): string => {
  return escapeUnsupportedCitTags(content).replace(CIT_ELEMENT_RE, '');
};

/**
 * Recursively walks a React child tree and replaces sentinel strings with
 * the result of `renderMarker(idx)`. Handles string children, arrays, and
 * React elements whose `children` prop is a string.
 */
export const replaceSentinelsInChildren = (
  children: ReactNode,
  renderMarker: (idx: number) => ReactNode,
): ReactNode => {
  if (typeof children === 'string') {
    const parts = children.split(SENTINEL_RE);
    if (parts.length === 1) return children;

    const result: ReactNode[] = [];
    parts.forEach((part, i) => {
      if (i % 2 === 1) {
        // Odd indices are the captured group (the idx digit string)
        result.push(renderMarker(parseInt(part, 10)));
      } else if (part) {
        result.push(part);
      }
    });
    return result;
  }

  if (Array.isArray(children)) {
    // React renders arrays natively — no Fragment wrapper needed
    return (children as ReactNode[]).flatMap((child) => {
      const replaced = replaceSentinelsInChildren(child, renderMarker);
      return Array.isArray(replaced) ? replaced : [replaced];
    });
  }

  return children;
};

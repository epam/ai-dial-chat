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
    .filter(({ g }) => g.primaryAnnotation.target?.selector?.type !== 'html_tag')
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

/** Matches a complete `<cit data-id="…">…</cit>` element, non-greedily. */
const CIT_ELEMENT_RE = /<cit\b[^>]*>[\s\S]*?<\/cit>/g;

/**
 * Hides every `<cit>` citation element from `content` while the message is
 * still streaming — including one whose opening tag has streamed in but
 * whose `</cit>` hasn't arrived yet (an HTML parser would otherwise treat
 * every character between the two as the element's content, which a
 * streaming re-render can't yet know the end of). Once the closing tag
 * arrives it renders as a real element instead (see
 * `useCitationMarkdownComponents`'s `cit` component override), so this is
 * only ever applied during streaming.
 */
export const stripCitTagsWhileStreaming = (content: string): string => {
  if (!content.includes('<cit')) return content;

  const withCompletePairsRemoved = content.replace(CIT_ELEMENT_RE, '');
  const danglingOpenTagIndex = withCompletePairsRemoved.indexOf('<cit');
  return danglingOpenTagIndex === -1
    ? withCompletePairsRemoved
    : withCompletePairsRemoved.slice(0, danglingOpenTagIndex);
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

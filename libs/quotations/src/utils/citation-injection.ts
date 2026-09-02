import type {
  HtmlTagSelector,
  TextCharacterRangeSelector,
} from '@epam/ai-dial-chat-shared';
import type { ReactNode } from 'react';
import type { AnnotationGroup } from './group-annotations-by-source';

/**
 * Sentinel pattern used to mark citation insertion points inside the raw
 * markdown string. Uses Unicode characters unlikely to appear in LLM output.
 *
 * Format: ⟦C{idx}⟧  where idx is the zero-based AnnotationGroup index.
 */
const SENTINEL_RE = /⟦C(\d+)⟧/g;

/** Matches a complete `<cit id="…">` void tag, capturing the id. */
const CIT_TAG_RE = /<cit\s+id="([^"]*)"\s*\/?>/g;

/**
 * Matches an incomplete trailing prefix of `<cit id="…">` at the very end of
 * a string — a tag currently split across a streaming chunk boundary. Stops
 * matching once a closing `"` for the id attribute appears, since a
 * complete-enough tag is handled by `CIT_TAG_RE` instead.
 */
const TRAILING_PARTIAL_CIT_TAG_RE = /<c(i(t(\s+i(d(="[^"]*)?)?)?)?)?$/;

/** Strips a trailing incomplete `<cit id="…">` fragment, if present, from the end of `content`. */
const stripTrailingPartialCitTag = (content: string): string => {
  const lastLt = content.lastIndexOf('<');
  if (lastLt === -1) return content;
  const tail = content.slice(lastLt);
  if (tail.includes('>')) return content;
  return TRAILING_PARTIAL_CIT_TAG_RE.test(tail)
    ? content.slice(0, lastLt)
    : content;
};

/**
 * Replaces every complete `<cit id="…">` tag in `content`: with its matching
 * sentinel when a group's `html_tag` selector has that `id`, or with `''`
 * (hidden) when no group matches yet.
 */
const stripAndReplaceCitTags = (
  content: string,
  groups: AnnotationGroup[],
): string => {
  if (!content.includes('<cit')) return content;

  const idToIdx = new Map<string, number>();
  groups.forEach((g, idx) => {
    const selector = g.primaryAnnotation.target?.selector;
    if (selector?.type === 'html_tag') {
      idToIdx.set((selector as HtmlTagSelector).id, idx);
    }
  });

  const withoutTrailingPartial = stripTrailingPartialCitTag(content);
  return withoutTrailingPartial.replace(CIT_TAG_RE, (_match, id: string) => {
    const idx = idToIdx.get(id);
    return idx != null ? `⟦C${idx}⟧` : '';
  });
};

/**
 * Injects citation sentinels into `content` at two kinds of insertion point:
 * every `<cit id="…">` tag (matched against a `groups` entry by id, or
 * stripped when unmatched — including a trailing tag fragment still
 * streaming in), and the character-offset `end` of every non-`html_tag`
 * group's primary selector (descending order so earlier insertions don't
 * shift later ones).
 */
export const injectCitationSentinels = (
  content: string,
  groups: AnnotationGroup[],
): string => {
  const withTagsHandled = stripAndReplaceCitTags(content, groups);

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
          : withTagsHandled.length;
      return { idx, pos: Math.min(end, withTagsHandled.length) };
    })
    .sort((a, b) => b.pos - a.pos);

  let result = withTagsHandled;
  for (const { idx, pos } of positions) {
    result = `${result.slice(0, pos)}⟦C${idx}⟧${result.slice(pos)}`;
  }
  return result;
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

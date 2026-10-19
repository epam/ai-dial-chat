import type { ReactNode } from 'react';
import type { Components } from 'react-markdown';
import type { InlineTextSegment, TextSegment } from '../models/inline-segment';

/*
 * Private-use code points: they carry no markdown meaning, so a token can
 * never open emphasis, a list or a link, and the parser leaves the text around
 * it exactly as written.
 */
const TOKEN_START = String.fromCharCode(0xe000);
const TOKEN_END = String.fromCharCode(0xe001);
const TOKEN_PATTERN = new RegExp(`${TOKEN_START}(\\d+)${TOKEN_END}`, 'g');
/* The same token after `href`/`src` normalization percent-encodes it. */
const ENCODED_TOKEN_PATTERN = new RegExp(
  `${encodeURI(TOKEN_START)}(\\d+)${encodeURI(TOKEN_END)}`,
  'gi',
);

/** Tag name of the hast element that marks an inline segment's position. */
const INLINE_SEGMENT_TAG_NAME = 'dial-inline-segment';

/*
 * Inside these elements a segment renders as its literal text: code must stay
 * a plain string for highlighting and copy, and an interactive element must
 * never nest inside a link.
 */
const LITERAL_TAG_NAMES = new Set(['code', 'pre', 'a']);

/* URL-valued properties a token can reach through an autolinked URL. */
const URL_PROPERTY_NAMES = ['href', 'src'];

/** Minimal hast shapes the inline-segment plugin reads and writes. */
interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/** Markdown source with inline segments replaced by placeholder tokens. */
export interface InlineSegmentSource {
  /** Markdown source to render, with one token per inline segment. */
  source: string;
  /** Inline segments in token order; a token's number is its index here. */
  inlineSegments: InlineTextSegment[];
}

const isInlineSegment = (segment: TextSegment): segment is InlineTextSegment =>
  typeof segment !== 'string';

const hasTokenCharacter = (value: string): boolean =>
  value.includes(TOKEN_START) || value.includes(TOKEN_END);

/**
 * Returns the markdown source for `segments`, with every inline segment
 * replaced by a placeholder token, or the plain concatenated text (and no
 * inline segments) when a string run already contains a token character.
 */
export const buildInlineSegmentSource = (
  segments: TextSegment[],
): InlineSegmentSource => {
  const hasCollision = segments.some(
    (segment) => !isInlineSegment(segment) && hasTokenCharacter(segment),
  );
  if (hasCollision) {
    return {
      source: segments
        .map((segment) => (isInlineSegment(segment) ? segment.text : segment))
        .join(''),
      inlineSegments: [],
    };
  }

  const inlineSegments: InlineTextSegment[] = [];
  const source = segments
    .map((segment) => {
      if (!isInlineSegment(segment)) return segment;
      inlineSegments.push(segment);
      return `${TOKEN_START}${inlineSegments.length - 1}${TOKEN_END}`;
    })
    .join('');

  return { source, inlineSegments };
};

const replaceTokensWithText = (
  value: string,
  inlineSegments: InlineTextSegment[],
): string =>
  value.replace(
    TOKEN_PATTERN,
    (token, index: string) => inlineSegments[Number(index)]?.text ?? token,
  );

const splitTextNode = (value: string): HastNode[] => {
  const parts: HastNode[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(TOKEN_PATTERN)) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: value.slice(lastIndex, match.index) });
    }
    parts.push({
      type: 'element',
      tagName: INLINE_SEGMENT_TAG_NAME,
      properties: { dataIndex: Number(match[1]) },
      children: [],
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    parts.push({ type: 'text', value: value.slice(lastIndex) });
  }
  return parts;
};

const restoreUrlProperties = (
  node: HastNode,
  inlineSegments: InlineTextSegment[],
): void => {
  if (node.properties == null) return;

  URL_PROPERTY_NAMES.forEach((name) => {
    const value = node.properties?.[name];
    if (typeof value === 'string' && node.properties) {
      node.properties[name] = replaceTokensWithText(
        value,
        inlineSegments,
      ).replace(ENCODED_TOKEN_PATTERN, (token, index: string) => {
        const text = inlineSegments[Number(index)]?.text;
        return text == null ? token : encodeURI(text);
      });
    }
  });
};

const visit = (
  node: HastNode,
  inlineSegments: InlineTextSegment[],
  isLiteral: boolean,
): void => {
  restoreUrlProperties(node, inlineSegments);
  if (node.children == null) return;

  const isChildLiteral =
    isLiteral || (node.tagName != null && LITERAL_TAG_NAMES.has(node.tagName));

  node.children = node.children.flatMap((child) => {
    if (child.type !== 'text' || child.value == null) {
      visit(child, inlineSegments, isChildLiteral);
      return [child];
    }
    if (isChildLiteral) {
      return [
        { ...child, value: replaceTokensWithText(child.value, inlineSegments) },
      ];
    }
    return splitTextNode(child.value);
  });
};

/**
 * Returns a rehype plugin that turns each placeholder token from
 * {@link buildInlineSegmentSource} into an inline-segment element, or into
 * the segment's literal text inside code, preformatted and link elements and
 * inside `href`/`src` values. Run it after sanitization, which would strip
 * the element.
 */
export const createRehypeInlineSegments =
  (inlineSegments: InlineTextSegment[]) => () => (tree: HastNode) => {
    visit(tree, inlineSegments, false);
  };

/** Props react-markdown passes to the inline-segment component. */
interface InlineSegmentElementProps {
  /** hast element being rendered. */
  node?: { properties?: Record<string, unknown> };
}

/**
 * Returns the react-markdown component overrides that render each
 * inline-segment element as its segment's `node`.
 */
export const createInlineSegmentComponents = (
  inlineSegments: InlineTextSegment[],
): Components => {
  const InlineSegment = ({ node }: InlineSegmentElementProps): ReactNode => {
    const index = Number(node?.properties?.dataIndex);
    return inlineSegments[index]?.node ?? null;
  };

  /*
   * `Components` is keyed by intrinsic element names, so the custom tag
   * needs a cast; react-markdown looks overrides up by tag name at runtime.
   */
  return { [INLINE_SEGMENT_TAG_NAME]: InlineSegment } as Components;
};

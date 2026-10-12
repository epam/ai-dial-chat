import type { ReactNode } from 'react';

/** An element rendered inline within message text, paired with the source text it stands for. */
export interface InlineTextSegment {
  /** Literal source text the element replaces, rendered instead of `node` where an element cannot appear (inside code or link text). */
  text: string;
  /** Element rendered at the segment's position in the text. */
  node: ReactNode;
}

/** One run of message text: a plain markdown string or an inline element segment. */
export type TextSegment = string | InlineTextSegment;

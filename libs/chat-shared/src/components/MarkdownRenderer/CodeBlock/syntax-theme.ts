import type { CSSProperties } from 'react';

/** Style map consumed by `react-syntax-highlighter`'s `Prism` renderer. */
type PrismStyleMap = Record<string, CSSProperties>;
// TODO: review colors
const MUTED: CSSProperties = { color: 'var(--text-secondary, #6B7280)' };
const BLUE: CSSProperties = { color: 'var(--text-accent, #1d4ed8)' };
const VIOLET: CSSProperties = {
  color: 'var(--text-accent-tertiary, #7e39ec)',
};
const INK: CSSProperties = { color: 'var(--text-primary, #161b2d)' };

/** Prism syntax-highlighting style map used by {@link MarkdownCodeBlock}, restrained to design-system CSS variables. */
export const restrainedSyntaxTheme: PrismStyleMap = {
  'code[class*="language-"]': {
    color: 'var(--text-primary, #161b2d)',
    background: 'none',
    textShadow: 'none',
  },
  'pre[class*="language-"]': {
    color: 'var(--text-primary, #161b2d)',
    background: 'none',
    textShadow: 'none',
  },
  comment: { ...MUTED, fontStyle: 'italic' },
  prolog: MUTED,
  cdata: MUTED,
  doctype: MUTED,
  punctuation: MUTED,
  entity: MUTED,
  operator: MUTED,
  'attr-name': MUTED,
  variable: MUTED,
  boolean: MUTED,
  number: MUTED,
  constant: MUTED,
  symbol: MUTED,
  deleted: MUTED,
  tag: MUTED,
  selector: MUTED,
  property: MUTED,
  namespace: MUTED,
  builtin: MUTED,

  // Blue — keywords and links.
  keyword: BLUE,
  atrule: BLUE,
  important: { ...BLUE, fontWeight: 'bold' },
  url: BLUE,

  // Violet — string/char literals (the closest general-language analog to
  // "inline code").
  string: VIOLET,
  char: VIOLET,
  regex: VIOLET,
  'attr-value': VIOLET,
  inserted: VIOLET,

  // Ink — bold text and structural identifiers.
  'class-name': INK,
  function: INK,
  bold: { ...INK, fontWeight: 'bold' },
  italic: { ...INK, fontStyle: 'italic' },

  'code.keyword': {
    ...VIOLET,
    background: 'var(--bg-accent-tertiary-alpha, #a972ff2e)',
    borderRadius: '5px',
    padding: '1px 5px',
  },
  'keyword.code': {
    ...VIOLET,
    background: 'var(--bg-accent-tertiary-alpha, #a972ff2e)',
    borderRadius: '5px',
    padding: '1px 5px',
  },
};

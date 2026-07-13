import type { CSSProperties } from 'react';

/** Style map consumed by `react-syntax-highlighter`'s `Prism` renderer. */
type PrismStyleMap = Record<string, CSSProperties>;

const MUTED: CSSProperties = { color: 'var(--text-secondary, #575f73)' };
/*
 * `--bg-accent-primary`, not `--text-accent-primary`: the same softer "brand
 * blue text" token already used for secondary/tertiary button labels in
 * `libs/ai-dial-kit/src/components/Button/Buttons.scss` — less saturated
 * than the raw accent-primary text color, while still clearing AA (5.23:1
 * light / 4.73:1 dark against the code surface; see syntax-theme.spec.ts).
 */
const BLUE: CSSProperties = { color: 'var(--bg-accent-primary, #2764d9)' };
const VIOLET: CSSProperties = {
  color: 'var(--text-accent-tertiary, #7e39ec)',
};
const INK: CSSProperties = { color: 'var(--text-primary, #161b2d)' };

/**
 * Restrained, AA-checked syntax palette for fenced code blocks, mapped to DS
 * tokens via CSS custom properties — so a single object renders correctly in
 * both the light and dark theme without a separate branch per theme (the
 * `dark`/`light` keys in {@link CodeBlock.tsx}'s `syntaxTheme` lookup both
 * point here; kept as two keys only so the existing `theme` prop and lookup
 * shape are unchanged).
 *
 * Roles: blue for keywords/links (and markdown headings), violet for
 * strings/inline-code-like tokens, ink for bold text and structural
 * identifiers (functions/class names), muted grey for everything else
 * (comments, punctuation, operators, numbers, booleans) — no per-token-type
 * "rainbow". Any token class not listed here inherits the base `ink` color
 * from `code[class*="language-"]`.
 *
 * The `code.keyword` / `keyword.code` entries style the "inline code" chip
 * that appears when a fenced block's language is `markdown`: refractor's
 * markdown grammar aliases its `code-snippet` token to `['code', 'keyword']`
 * and drops the `code-snippet` type name entirely, so the rendered element
 * carries exactly the classes `code keyword` — colliding with the generic
 * `keyword` (blue) rule unless overridden by that exact two-class
 * combination (react-syntax-highlighter looks up style objects by every
 * permutation of a token's class names, keyed by dot-joined combos; see
 * `createStyleObject` in `react-syntax-highlighter/dist/esm/create-element.js`).
 * Both dot-orderings are defined since the permutation order isn't a public
 * contract. Background carries a known WCAG AA gap in the dark theme
 * (violet-on-violet-tint composites to ~3.7:1, below the 4.5:1 threshold);
 * accepted for now, see `syntax-theme.spec.ts`.
 */
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

  // Muted grey — comments, punctuation, and other low-signal tokens.
  // Comments are additionally italic, distinguishing them from punctuation/
  // operators/etc., which share the same muted color but stay upright.
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

  // Markdown grammar — heading (`important`), link (`url`), bold/italic, and
  // blockquote/hr/list markers (`punctuation`) already resolve through the
  // generic roles above, since refractor's markdown grammar aliases each of
  // those token types to one of these existing names. Only the inline-code
  // "chip" needs a dedicated entry, since its two-class combination
  // (`code keyword`) would otherwise collide with the plain `keyword` rule.
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

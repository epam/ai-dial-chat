import { describe, expect, it } from 'vitest';
import { restrainedSyntaxTheme } from '../CodeBlock/syntax-theme';

/** Extracts the fallback hex from a `var(--token, #fallback)` string. */
const fallbackHex = (value: unknown): string => {
  const match = /var\([^,]+,\s*(#[0-9a-fA-F]{6,8})\)/.exec(String(value));
  if (!match) throw new Error(`No var() fallback hex found in: ${value}`);
  return match[1].slice(0, 7); // drop alpha channel, if present
};

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const relativeLuminance = ([r, g, b]: [number, number, number]): number => {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** WCAG contrast ratio between two hex colors, e.g. `contrast('#161b2d', '#fcfcfc')`. */
const contrast = (hexA: string, hexB: string): number => {
  const lumA = relativeLuminance(hexToRgb(hexA));
  const lumB = relativeLuminance(hexToRgb(hexB));
  const [lighter, darker] = lumA > lumB ? [lumA, lumB] : [lumB, lumA];
  return (lighter + 0.05) / (darker + 0.05);
};

const AA_NORMAL_TEXT = 4.5;

/*
 * Resolved theme-config values (see Phase 1 discovery) — not hardcoded design
 * choices, these mirror the real `/api/themes` response so the ratios below
 * reflect what actually renders. Light is `--bg-layer-6`'s fallback
 * (`#F8FAFC`, applied via `.containerLight`/`.headerLight` in
 * `CodeBlock.module.scss` — the API doesn't return a `bg-layer-6` value for
 * either theme, so this is a light-mode-only override, not a theme-reactive
 * token like `--bg-layer-0`..`--bg-layer-4`). Dark keeps `--bg-layer-3`'s
 * real resolved value from the theme API.
 */
const SURFACE = { light: '#F8FAFC', dark: '#1D2439' };
const ROLES = {
  light: {
    'ink (bold/italic, class-name/function)': '#161B2D',
    'muted (punctuation/comment/etc., language label)': '#575F73',
    'blue (keyword/link, markdown heading)': '#2764D9',
    'violet (string/char, markdown inline code)': '#7E39EC',
  },
  dark: {
    'ink (bold/italic, class-name/function)': '#EEF1F7',
    'muted (punctuation/comment/etc., language label)': '#9FA6BD',
    'blue (keyword/link, markdown heading)': '#5C8DEA',
    'violet (string/char, markdown inline code)': '#A972FF',
  },
};

describe('restrainedSyntaxTheme — token role coverage', () => {
  it('defines a single color per role, reused across every mapped Prism token', () => {
    const roleKeys: Record<string, string[]> = {
      muted: [
        'comment',
        'prolog',
        'cdata',
        'doctype',
        'punctuation',
        'entity',
        'operator',
        'attr-name',
        'variable',
        'boolean',
        'number',
        'constant',
        'symbol',
        'deleted',
        'tag',
        'selector',
        'property',
        'namespace',
        'builtin',
      ],
      blue: ['keyword', 'atrule', 'url'],
      violet: ['string', 'char', 'regex', 'attr-value', 'inserted'],
      ink: ['class-name', 'function'],
    };

    for (const keys of Object.values(roleKeys)) {
      const colors = keys.map((key) => restrainedSyntaxTheme[key]?.color);
      expect(colors.every((c) => c === colors[0])).toBe(true);
      expect(colors[0]).toBeTruthy();
    }
  });

  it('gives bold and italic tokens the ink color plus their font style, not a new hue', () => {
    expect(restrainedSyntaxTheme.bold?.fontWeight).toBe('bold');
    expect(restrainedSyntaxTheme.italic?.fontStyle).toBe('italic');
    expect(restrainedSyntaxTheme.bold?.color).toBe(
      restrainedSyntaxTheme['class-name']?.color,
    );
    expect(restrainedSyntaxTheme.italic?.color).toBe(
      restrainedSyntaxTheme.bold?.color,
    );
  });

  it('renders comments in italic, unlike punctuation/operators/etc. which share the same muted color', () => {
    expect(restrainedSyntaxTheme.comment?.fontStyle).toBe('italic');
    expect(restrainedSyntaxTheme.comment?.color).toBe(
      restrainedSyntaxTheme.punctuation?.color,
    );
    expect(restrainedSyntaxTheme.punctuation?.fontStyle).not.toBe('italic');
  });

  it('styles the markdown heading (important), link (url), and blockquote/hr/list markers (punctuation) via the generic roles', () => {
    /*
     * refractor's markdown grammar aliases `title` to `important`, `url` stays
     * its own type, and `blockquote`/`hr`/`list` alias to `punctuation` — so
     * these already resolve through the generic role entries above with no
     * markdown-specific key needed.
     */
    expect(restrainedSyntaxTheme.important?.color).toBe(
      restrainedSyntaxTheme.keyword?.color,
    );
    expect(restrainedSyntaxTheme.url?.color).toBe(
      restrainedSyntaxTheme.keyword?.color,
    );
    expect(restrainedSyntaxTheme.punctuation?.color).toBe(
      restrainedSyntaxTheme.comment?.color,
    );
  });

  it('gives the markdown inline-code snippet a violet chip (text + tinted background), keyed to its actual two-class combination', () => {
    /*
     * refractor aliases the `code-snippet` token to `['code', 'keyword']` and
     * drops the `code-snippet` type name, so the rendered element carries
     * exactly `code keyword` — verified against the live DOM, not just the
     * grammar source.
     */
    const chip = restrainedSyntaxTheme['code.keyword'];
    const chipReversed = restrainedSyntaxTheme['keyword.code'];
    expect(chip?.color).toBe(restrainedSyntaxTheme.string?.color);
    expect(chip?.background).toBeTruthy();
    expect(chip?.borderRadius).toBeTruthy();
    expect(chipReversed).toEqual(chip);
  });
});

describe('restrainedSyntaxTheme — WCAG AA contrast (>=4.5:1)', () => {
  it.each(['light', 'dark'] as const)(
    'every syntax color passes AA against the %s-theme code surface',
    (mode) => {
      const surface = SURFACE[mode];
      for (const [role, hex] of Object.entries(ROLES[mode])) {
        const ratio = contrast(hex, surface);
        // eslint-disable-next-line no-console
        console.log(
          `[AA:${mode}] ${role}: ${hex} on ${surface} = ${ratio.toFixed(2)}:1`,
        );
        expect(ratio, `${role} (${hex} on ${surface})`).toBeGreaterThanOrEqual(
          AA_NORMAL_TEXT,
        );
      }
    },
  );

  it('confirms the syntax-theme.ts fallback hexes match the resolved theme-config values', () => {
    expect(fallbackHex(restrainedSyntaxTheme.keyword?.color)).toBe(
      ROLES.light['blue (keyword/link, markdown heading)'].toLowerCase(),
    );
    expect(fallbackHex(restrainedSyntaxTheme.string?.color)).toBe(
      ROLES.light['violet (string/char, markdown inline code)'].toLowerCase(),
    );
    expect(fallbackHex(restrainedSyntaxTheme['class-name']?.color)).toBe(
      ROLES.light['ink (bold/italic, class-name/function)'].toLowerCase(),
    );
    expect(fallbackHex(restrainedSyntaxTheme.comment?.color)).toBe(
      ROLES.light[
        'muted (punctuation/comment/etc., language label)'
      ].toLowerCase(),
    );
  });

  it(
    'KNOWN GAP (accepted, deferred): the markdown inline-code chip background ' +
      'fails AA in the dark theme — violet text composited over its own ' +
      'violet-tinted background crushes contrast to ~3.7:1. Printed here so ' +
      'the gap stays visible instead of silently passing.',
    () => {
      const violetOnDarkSurface = '#36325C'; // A972FF at ~18% over #1D2439
      const ratio = contrast('#A972FF', violetOnDarkSurface);
      // eslint-disable-next-line no-console
      console.log(
        `[AA:dark] inline-code chip (violet-on-violet-tint): ${ratio.toFixed(2)}:1 — below ${AA_NORMAL_TEXT}:1, accepted per product decision`,
      );
      expect(ratio).toBeLessThan(AA_NORMAL_TEXT);
    },
  );
});

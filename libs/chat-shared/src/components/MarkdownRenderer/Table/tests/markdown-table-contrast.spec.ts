import { describe, expect, it } from 'vitest';

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbToHex = ([r, g, b]: [number, number, number]): string =>
  `#${[r, g, b]
    .map((c) => Math.round(c).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;

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

/** Composites a translucent foreground (hex + 0-1 alpha) over an opaque background hex. */
const compositeOver = (fgHex: string, alpha: number, bgHex: string): string => {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  const mixed = fg.map((c, i) => bg[i] * (1 - alpha) + c * alpha) as [
    number,
    number,
    number,
  ];
  return rgbToHex(mixed);
};

const AA_NORMAL_TEXT = 4.5;

/*
 * Resolved DS token values, reused verbatim from the already-verified sources
 * in this codebase (same tokens, same session-established hexes):
 * - `libs/attachment-input/src/utils/tests/attachment-colors-contrast.spec.ts`
 *   for bg-layer-2/3/6 and text-primary/secondary.
 * - `libs/chat-shared/src/components/MarkdownRenderer/tests/syntax-theme.spec.ts`
 *   for the code-block surface family the table container reuses.
 */
const CONTAINER = { light: '#FCFCFC', dark: '#1D2439' }; // bg-layer-3 — header bg in both themes; body bg when no theme override
const CONTAINER_LIGHT_OVERRIDE = '#F8FAFC'; // bg-layer-6 — body bg only when an explicit light theme is passed (message tables)
/*
 * bg-layer-5 — the cool-toned surface already hardcoded for the same purpose
 * elsewhere in this codebase (Catalog.module.scss's `--cat-bg`,
 * NewChatButton.module.scss), reused here as the literal token rather than
 * a computed opacity blend or the neutral bg-layer-7 wash (which read warm
 * against this DS's cool blue-grey palette). The light hex is doubly
 * confirmed (tailwind.config.js + those two call sites); no dark-theme
 * literal for bg-layer-5 is independently confirmed in this codebase
 * snapshot, so bg-layer-3's confirmed dark value stands in as the closest
 * same-family surface tone for this check.
 */
const ZEBRA = { light: '#F5F7FA', dark: CONTAINER.dark };
const HOVER_TINT = { hex: '#7DA4FF', alpha: 0.18 }; // bg-accent-primary-alpha (~#7da4ff2e)

const TEXT_PRIMARY = { light: '#161B2D', dark: '#EEF1F7' }; // td body text (ambient text-primary)
const TEXT_SECONDARY = { light: '#575F73', dark: '#9FA6BD' }; // th header text

describe('MarkdownTable — WCAG AA contrast (>=4.5:1)', () => {
  it.each(['light', 'dark'] as const)(
    'header text passes AA against the sticky header background in %s theme',
    (mode) => {
      const ratio = contrast(TEXT_SECONDARY[mode], CONTAINER[mode]);
      // eslint-disable-next-line no-console
      console.log(
        `[AA:${mode}] header text: ${TEXT_SECONDARY[mode]} on ${CONTAINER[mode]} = ${ratio.toFixed(2)}:1`,
      );
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    },
  );

  it.each(['light', 'dark'] as const)(
    'body text passes AA against the plain container background in %s theme',
    (mode) => {
      const ratio = contrast(TEXT_PRIMARY[mode], CONTAINER[mode]);
      // eslint-disable-next-line no-console
      console.log(
        `[AA:${mode}] body text (no zebra): ${TEXT_PRIMARY[mode]} on ${CONTAINER[mode]} = ${ratio.toFixed(2)}:1`,
      );
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    },
  );

  it.each(['light', 'dark'] as const)(
    'body text passes AA against the zebra (even row) background in %s theme',
    (mode) => {
      const ratio = contrast(TEXT_PRIMARY[mode], ZEBRA[mode]);
      // eslint-disable-next-line no-console
      console.log(
        `[AA:${mode}] body text (zebra row): ${TEXT_PRIMARY[mode]} on ${ZEBRA[mode]} = ${ratio.toFixed(2)}:1`,
      );
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    },
  );

  it('body text passes AA against the light-theme-override container background (message tables)', () => {
    const ratio = contrast(TEXT_PRIMARY.light, CONTAINER_LIGHT_OVERRIDE);
    // eslint-disable-next-line no-console
    console.log(
      `[AA:light] body text (markdown-surface override): ${TEXT_PRIMARY.light} on ${CONTAINER_LIGHT_OVERRIDE} = ${ratio.toFixed(2)}:1`,
    );
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it.each(['light', 'dark'] as const)(
    'body text passes AA against the composited row-hover tint in %s theme',
    (mode) => {
      const baseBg = mode === 'light' ? ZEBRA.light : CONTAINER.dark;
      const hoverBg = compositeOver(HOVER_TINT.hex, HOVER_TINT.alpha, baseBg);
      const ratio = contrast(TEXT_PRIMARY[mode], hoverBg);
      // eslint-disable-next-line no-console
      console.log(
        `[AA:${mode}] body text (row hover): ${TEXT_PRIMARY[mode]} on ${hoverBg} (composited) = ${ratio.toFixed(2)}:1`,
      );
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    },
  );

  it('the header and zebra surfaces are visually distinct in light theme (non-identical resolved colors)', () => {
    // Dark theme isn't asserted here: bg-layer-5's dark literal isn't
    // independently confirmed (see the ZEBRA comment above), so ZEBRA.dark
    // stands in as bg-layer-3's own value rather than a proven-distinct one.
    expect(CONTAINER.light).not.toBe(ZEBRA.light);
  });
});

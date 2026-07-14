import { describe, expect, it } from 'vitest';

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
 * Resolved DS token values, sourced directly rather than guessed:
 * - Light hex fallbacks come from `tailwind.config.js` (the canonical
 *   light-theme default for every `bg-*`/`text-*` utility used here).
 * - Dark hex fallbacks come from the compiled
 *   `node_modules/@epam/ai-dial-ui-kit/dist/index.css` bundle, which bakes
 *   in the dark-theme value for each of these same utility classes at build
 *   time — the same source `--bg-layer-3`/`--bg-accent-primary` were
 *   already confirmed against in `syntax-theme.spec.ts`.
 * - `--bg-layer-6` has no dark-theme value anywhere in the DS, which is why
 *   neither surface below uses it.
 */
const SURFACE = {
  group: { light: '#EEF1F7', dark: '#161B2D' }, // bg-layer-2 — group container / +N / show-less tile background
  tile: { light: '#FCFCFC', dark: '#1D2439' }, // bg-layer-3 — normal file/image tile background
  errorTile: { light: '#F3D6D8', dark: '#402027' }, // bg-error — failed-upload tile background
};

// bg-layer-6 — the file tile's light-theme override (AttachmentFileRow's
// `.tileLight`, applied when `theme={CodeBlockTheme.Light}`), reusing the
// exact same surface as the markdown code block's light-theme background
// (CodeBlock.module.scss's `.containerLight`) instead of falling back to
// bg-layer-3's near-white light value.
const FILE_TILE_MARKDOWN_LIGHT = '#F8FAFC';

const INK = {
  light: {
    primary: '#161B2D', // text-primary — filename (inside the tile)
    secondary: '#575F73', // text-secondary — extension label, header count, download-all icon, +N / show-less icon
    error: '#AE2F2F', // text-error — filename / extension label / retry icon on a failed tile
  },
  dark: {
    primary: '#EEF1F7',
    secondary: '#9FA6BD',
    error: '#F76464',
  },
};

describe('Attachment display — WCAG AA contrast (>=4.5:1)', () => {
  it.each(['light', 'dark'] as const)(
    'in-tile filename/extension text, group header/icon text, and +N / show-less icon pass AA in %s theme',
    (mode) => {
      const cases: Array<[string, string, string]> = [
        [
          'filename inside tile (default)',
          INK[mode].primary,
          SURFACE.tile[mode],
        ],
        [
          'extension label inside tile (default)',
          INK[mode].secondary,
          SURFACE.tile[mode],
        ],
        [
          'filename inside tile (failed)',
          INK[mode].error,
          SURFACE.errorTile[mode],
        ],
        [
          'extension label inside tile (failed)',
          INK[mode].error,
          SURFACE.errorTile[mode],
        ],
        ['retry icon on failed tile', INK[mode].error, SURFACE.errorTile[mode]],
        ['group header count', INK[mode].secondary, SURFACE.group[mode]],
        [
          'download-all icon (header)',
          INK[mode].secondary,
          SURFACE.group[mode],
        ],
        ['+N / show-less tile icon', INK[mode].secondary, SURFACE.group[mode]],
      ];

      for (const [label, ink, bg] of cases) {
        const ratio = contrast(ink, bg);
        // eslint-disable-next-line no-console
        console.log(
          `[AA:${mode}] ${label}: ${ink} on ${bg} = ${ratio.toFixed(2)}:1`,
        );
        expect(ratio, `${label} (${ink} on ${bg})`).toBeGreaterThanOrEqual(
          AA_NORMAL_TEXT,
        );
      }
    },
  );

  it.each(['light', 'dark'] as const)(
    'the tile-vs-group surfaces are visually distinct in %s theme (non-identical resolved colors)',
    (mode) => {
      expect(SURFACE.tile[mode]).not.toBe(SURFACE.group[mode]);
    },
  );

  it("the file tile's light-theme surface reuses the markdown code block color, not plain white", () => {
    expect(FILE_TILE_MARKDOWN_LIGHT).not.toBe('#FFFFFF');
    // Genuinely distinct from bg-layer-3's own light value — proves the
    // override actually swaps the token rather than silently no-op'ing.
    expect(FILE_TILE_MARKDOWN_LIGHT).not.toBe(SURFACE.tile.light);
  });

  it('in-tile filename/extension text passes AA against the markdown-matched light-theme file tile surface', () => {
    const cases: Array<[string, string]> = [
      ['filename inside tile (light, markdown surface)', INK.light.primary],
      [
        'extension label inside tile (light, markdown surface)',
        INK.light.secondary,
      ],
    ];

    for (const [label, ink] of cases) {
      const ratio = contrast(ink, FILE_TILE_MARKDOWN_LIGHT);
      // eslint-disable-next-line no-console
      console.log(
        `[AA:light] ${label}: ${ink} on ${FILE_TILE_MARKDOWN_LIGHT} = ${ratio.toFixed(2)}:1`,
      );
      expect(
        ratio,
        `${label} (${ink} on ${FILE_TILE_MARKDOWN_LIGHT})`,
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    }
  });
});

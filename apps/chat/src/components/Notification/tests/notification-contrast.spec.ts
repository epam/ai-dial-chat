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
const AA_NON_TEXT = 3;

/*
 * Resolved DS token values for the toast restyle, taken directly from
 * `tailwind.config.js` (light fallbacks) and the live `/api/themes` response
 * (dark values) — the same tokens applied in NotificationContainer.module.scss.
 */
const SEVERITIES = {
  error: {
    bg: { light: '#F3D6D8', dark: '#402027' },
    ink: { light: '#AE2F2F', dark: '#F76464' },
    icon: { light: '#AE2F2F', dark: '#F76464' },
  },
  warning: {
    bg: { light: '#FAF0CF', dark: '#3F3D25' },
    ink: { light: '#7F6300', dark: '#EEC840' }, // text-warning — deeper in light, same as icon in dark (DS provides only one tone there)
    icon: { light: '#EEC840', dark: '#EEC840' }, // text-warning-icon
  },
  info: {
    bg: { light: '#D6E2F9', dark: '#1C2C47' },
    ink: { light: '#124ACE', dark: '#7DA4FF' },
    icon: { light: '#124ACE', dark: '#7DA4FF' },
  },
  success: {
    bg: { light: '#D9F0F1', dark: '#1D3841' },
    ink: { light: '#007274', dark: '#37BABC' },
    icon: { light: '#007274', dark: '#37BABC' },
  },
} as const;

const LOADING = {
  bg: { light: '#FCFCFC', dark: '#1D2439' }, // bg-neutral
  ink: { light: '#161B2D', dark: '#EEF1F7' }, // text-primary
};

// Dismiss button at rest — DialGhostIconButton's own text-secondary color.
const DISMISS_X = { light: '#575F73', dark: '#9FA6BD' };

const THEMES = ['light', 'dark'] as const;
const NAMED_SEVERITIES = Object.keys(SEVERITIES) as (keyof typeof SEVERITIES)[];

describe('Toast (DialNotification restyle) — WCAG AA contrast', () => {
  describe.each(NAMED_SEVERITIES)('%s severity', (severity) => {
    const tokens = SEVERITIES[severity];

    it.each(THEMES)(
      'message ink passes AA normal text (>=4.5:1) in %s theme',
      (mode) => {
        const ratio = contrast(tokens.ink[mode], tokens.bg[mode]);
        // eslint-disable-next-line no-console
        console.log(
          `[AA:${mode}] ${severity} message: ${tokens.ink[mode]} on ${tokens.bg[mode]} = ${ratio.toFixed(2)}:1`,
        );
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      },
    );

    it('dismiss X passes AA non-text (>=3:1) against the tint in both themes', () => {
      for (const mode of THEMES) {
        const ratio = contrast(DISMISS_X[mode], tokens.bg[mode]);
        // eslint-disable-next-line no-console
        console.log(
          `[AA:${mode}] ${severity} dismiss-x: ${DISMISS_X[mode]} on ${tokens.bg[mode]} = ${ratio.toFixed(2)}:1`,
        );
        expect(ratio).toBeGreaterThanOrEqual(AA_NON_TEXT);
      }
    });
  });

  it('warning icon passes AA non-text (>=3:1) against the warning tint in dark theme', () => {
    const ratio = contrast(
      SEVERITIES.warning.icon.dark,
      SEVERITIES.warning.bg.dark,
    );
    // eslint-disable-next-line no-console
    console.log(
      `[AA:dark] warning icon: ${SEVERITIES.warning.icon.dark} on ${SEVERITIES.warning.bg.dark} = ${ratio.toFixed(2)}:1`,
    );
    expect(ratio).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it(
    'KNOWN GAP (pre-existing, out of scope): the warning icon fails AA non-text ' +
      '(>=3:1) against the warning tint in light theme — text-warning-icon is the ' +
      "DS's only bright tone for this severity and isn't being redesigned here",
    () => {
      const ratio = contrast(
        SEVERITIES.warning.icon.light,
        SEVERITIES.warning.bg.light,
      );
      // eslint-disable-next-line no-console
      console.log(
        `[AA:light] warning icon (KNOWN GAP): ${SEVERITIES.warning.icon.light} on ${SEVERITIES.warning.bg.light} = ${ratio.toFixed(2)}:1 — below ${AA_NON_TEXT}:1`,
      );
      expect(ratio).toBeLessThan(AA_NON_TEXT);
    },
  );

  it.each(THEMES)(
    'loading message ink passes AA normal text (>=4.5:1) in %s theme',
    (mode) => {
      const ratio = contrast(LOADING.ink[mode], LOADING.bg[mode]);
      // eslint-disable-next-line no-console
      console.log(
        `[AA:${mode}] loading message: ${LOADING.ink[mode]} on ${LOADING.bg[mode]} = ${ratio.toFixed(2)}:1`,
      );
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    },
  );

  it.each(THEMES)(
    'dismiss X passes AA non-text (>=3:1) against the neutral loading card in %s theme',
    (mode) => {
      const ratio = contrast(DISMISS_X[mode], LOADING.bg[mode]);
      // eslint-disable-next-line no-console
      console.log(
        `[AA:${mode}] loading dismiss-x: ${DISMISS_X[mode]} on ${LOADING.bg[mode]} = ${ratio.toFixed(2)}:1`,
      );
      expect(ratio).toBeGreaterThanOrEqual(AA_NON_TEXT);
    },
  );

  it('every severity resolves to a visually distinct tint background in light theme', () => {
    const tints: string[] = NAMED_SEVERITIES.map((s) => SEVERITIES[s].bg.light);
    tints.push(LOADING.bg.light);
    expect(new Set(tints).size).toBe(tints.length);
  });
});

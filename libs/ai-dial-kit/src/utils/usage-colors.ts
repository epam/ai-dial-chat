import {
  type UsageLimitStateColors,
  UsageLimitState,
} from '../types/usage-limit';

/**
 * Orange DS token with no named Tailwind utility in this app. Used only for the decorative
 * meter/dot fill (applied via inline style, since this app's Tailwind setup does not reliably
 * generate rules for bracketed `var(--x,#fallback)` classes) — never for text, since at ~3:1
 * against light backgrounds it fails WCAG AA as a text color. `text-warning` (darker) is used
 * for text in the `Warning` state instead.
 */
export const USAGE_WARNING_FILL_COLOR_VALUE = 'var(--bg-orange-400, #D97C27)';

/**
 * Shared meter/text/dot colors per `UsageLimitState`: green (`accent-secondary`) under the
 * warning threshold, orange at/above it, red once the cap is reached. Reused by every usage
 * component so the whole feature reads as one consistent color language. Every `textClassName`
 * here is verified to pass WCAG AA (≥4.5:1) against this app's page and card backgrounds.
 */
export const DEFAULT_USAGE_STATE_COLORS: Record<
  UsageLimitState,
  UsageLimitStateColors
> = {
  [UsageLimitState.Normal]: {
    textClassName: 'text-accent-secondary',
    fillClassName: 'bg-accent-secondary',
  },
  [UsageLimitState.Warning]: {
    textClassName: 'text-warning',
    fillColorValue: USAGE_WARNING_FILL_COLOR_VALUE,
  },
  [UsageLimitState.Blocked]: {
    textClassName: 'text-error',
    fillClassName: 'bg-controls-error',
  },
  [UsageLimitState.Unlimited]: {
    textClassName: 'text-secondary',
    fillClassName: 'bg-layer-4',
  },
};

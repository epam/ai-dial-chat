import type { Stage } from '@epam/ai-dial-chat-shared';

/** Color overrides for the `CollapsedGroup` component applied as CSS custom properties. */
export interface CollapsedGroupColors {
  /** Color of the toggle button label and icon. Defaults to `var(--text-secondary, #9fa6bd)`. */
  labelColor?: string;
  /** Color of the toggle button label and icon on hover. Defaults to `var(--text-primary, #eef1f7)`. */
  labelHoverColor?: string;
  /** Color of the steps count. Defaults to `var(--text-primary, #eef1f7)`. */
  stepsCountColor?: string;
  /** Border color of the completed-stages content box. Defaults to `var(--stroke-secondary, #242c42)`. */
  contentBorderColor?: string;
}

/** Typography configuration for the toggle button label text. */
export interface CollapsedGroupTypography {
  /** CSS utility class applied to the toggle button label. Defaults to `'dial-tiny-text'`. */
  fontClassName?: string;
  /** Font family applied to the panel root via CSS custom property. */
  fontFamily?: string;
}

/** Combined style overrides (colors and typography) for the `CollapsedGroup` component. */
export interface CollapsedGroupStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: CollapsedGroupColors;
  /** Typography for the toggle button label. Defaults to `{ fontClassName: 'dial-tiny-text' }`. */
  typography?: CollapsedGroupTypography;
}

/** Props accepted by the `CollapsedGroup` component. */
export interface CollapsedGroupProps {
  /** Ordered list of stages to display. */
  stages: Stage[];
  /** When `true` the component renders all stages directly via `StagesPanel` without collapsing. */
  isStreaming: boolean;
  /** Label shown before the steps count on the toggle button. Defaults to `'Executed'`. */
  executedLabel?: string;
  /** Returns the pluralized label for the steps count. Receives the count so callers can handle any plural rule. Defaults to `() => 'steps'`. */
  stepsLabel?: (count: number) => string;
  /** Extra class name(s) merged onto the outer wrapper. */
  className?: string;
  /** Color and typography overrides applied as CSS custom properties. */
  styles?: CollapsedGroupStyles;
  /** Minimum number of stages required to activate the collapse behaviour. Defaults to `7`. */
  collapseThreshold?: number;
}

import type { StarterOption } from '@epam/ai-dial-chat-shared';

/** Accessible labels used by the `StarterButtons` component. */
export interface StarterButtonsLabels {
  /** Accessible label (`aria-label`) for the visible buttons list. */
  list: string;
  /** Accessible label (`aria-label`) for the overflow menu button. */
  overflow: string;
}

/** Style overrides for the `StarterButtons` component. */
export interface StarterButtonsStyles {
  /** Icon size in px for the overflow menu icon. Defaults to `BASE_MD_ICON_PROPS.size`. */
  iconSize?: number;
  /** Stroke width for the overflow menu icon. Defaults to `BASE_MD_ICON_PROPS.stroke`. */
  iconStrokeWidth?: number;
}

/** Props for the `StarterButtons` component. */
export interface StarterButtonsProps {
  /** Starter prompt options to display as buttons. */
  starters: StarterOption[];
  /** Called when the user selects a starter option. */
  onSelect: (starter: StarterOption) => void;
  /** When `true`, renders a mobile-optimised layout. */
  isMobile?: boolean;
  /**
   * When `true` (the default), only as many starters as the measured
   * container width allows stay on one row and the rest collapse into an
   * overflow dropdown. When `false`, every starter is rendered, each on its
   * own row, and no overflow menu appears.
   */
  isCollapsible?: boolean;
  /** Localized labels used within the component. */
  labels: StarterButtonsLabels;
  /** Optional style overrides. */
  styles?: StarterButtonsStyles;
}

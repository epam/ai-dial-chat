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
  /** Localized labels used within the component. */
  labels: StarterButtonsLabels;
  /** Optional style overrides. */
  styles?: StarterButtonsStyles;
}

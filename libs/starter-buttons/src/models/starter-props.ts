import type { StarterOption } from '@epam/ai-dial-chat-shared';

/** Localized text strings used by the StarterButtons component. */
export interface StarterButtonsLabels {
  /** Label for the visible list of starter buttons. */
  list: string;
  /** Label for the overflow menu that holds buttons that do not fit. */
  overflow: string;
}

/** Props for the StarterButtons component. */
export interface StarterButtonsProps {
  /** Starter prompt options to display as buttons. */
  starters: StarterOption[];
  /** Called when the user selects a starter option. */
  onSelect: (starter: StarterOption) => void;
  /** When `true`, renders a mobile-optimised layout. */
  isMobile?: boolean;
  /** Localized labels used within the component. */
  labels: StarterButtonsLabels;
}

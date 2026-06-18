import type { StarterOption } from '@epam/ai-dial-chat-shared';

export interface StarterButtonsAriaLabels {
  list: string;
  overflow: string;
}

export interface StarterButtonsProps {
  starters: StarterOption[];
  onSelect: (starter: StarterOption) => void;
  isMobile?: boolean;
  ariaLabels: StarterButtonsAriaLabels;
}

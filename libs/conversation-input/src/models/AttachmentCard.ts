import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';

/** CSS custom-property overrides for the `AttachmentCard` component. */
export interface AttachmentCardColors {
  /** Card border color in the default state. */
  border?: string;
  /** Card background color in the default state. */
  background?: string;
  /** File name text color. */
  nameText?: string;
  /** Meta (type / label) text color. */
  metaText?: string;
}

/** Typography overrides for the `AttachmentCard` component. */
export interface AttachmentCardTypography {
  /** Utility class applied to the file name text. Defaults to `'dial-tiny-text'`. */
  fontClassName?: string;
  /** Utility class applied to the bottom meta label (file type / status). Defaults to `'dial-tiny-text'`. */
  metaClassName?: string;
}

/** Props accepted by the `AttachmentCard` component. */
export interface AttachmentCardProps {
  /** The attachment data to display. */
  attachment: DisplayAttachment;
  /** Called when the user activates the remove button. */
  onRemove?: (id: string) => void;
  /** Called when the user activates the retry button (error state only). */
  onRetry?: (id: string) => void;
  /** Called when the user clicks or activates a pasted-text card to expand its content back into the input. */
  onExpand?: (id: string) => void;
  /** Renders the card in selected state (accent border + tinted background). */
  isSelected?: boolean;
  /** Forces action buttons to be always visible regardless of hover/focus state. */
  shouldAlwaysShowActions?: boolean;
  /** Accessible label for the remove button. */
  removeLabel?: string;
  /** Accessible label for the retry button (error state only). */
  retryLabel?: string;
  /** Called when the user clicks or keyboard-activates the card. Receives the attachment `id`. */
  onClick?: (id: string) => void;
  /** Accessible label applied to the card root when it is interactive via `onClick`. Defaults to `'Open attachment'`. */
  clickLabel?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: AttachmentCardColors;
  /** Typography overrides for text elements inside the card. */
  typography?: AttachmentCardTypography;
  /** Tailwind border-radius utility class applied to the card and its inner layers (e.g. `'rounded'`, `'rounded-lg'`). */
  roundedClassName?: string;
  /** Extra class name(s) merged onto the root element. */
  className?: string;
}

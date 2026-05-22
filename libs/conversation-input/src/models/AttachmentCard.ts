import type { Attachment } from '@epam/ai-dial-chat-shared';

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
  /** Utility class applied to the file name text (e.g. `'dial-tiny-text'`, `'text-xs'`). */
  fontClassName?: string;
}

/** Props accepted by the `AttachmentCard` component. */
export interface AttachmentCardProps {
  /** The attachment data to display. */
  attachment: Attachment;
  /** Called when the user activates the remove button. */
  onRemove: (id: string) => void;
  /** Called when the user activates the retry button (error state only). */
  onRetry?: (id: string) => void;
  /** Renders the card in selected state (accent border + tinted background). */
  selected?: boolean;
  /** Forces action buttons to be always visible regardless of hover/focus state. */
  alwaysShowActions?: boolean;
  /** Accessible label for the remove button. */
  removeLabel?: string;
  /** Accessible label for the retry button (error state only). */
  retryLabel?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: AttachmentCardColors;
  /** Typography overrides for text elements inside the card. */
  typography?: AttachmentCardTypography;
  /** Tailwind border-radius utility class applied to the card and its inner layers (e.g. `'rounded'`, `'rounded-lg'`). */
  roundedClassName?: string;
  /** Extra class name(s) merged onto the root element. */
  className?: string;
}

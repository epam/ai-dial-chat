import type { Attachment } from '@epam/ai-dial-chat-shared';

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
  /** Extra class name(s) merged onto the root element. */
  className?: string;
}

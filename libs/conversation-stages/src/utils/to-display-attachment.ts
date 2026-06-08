import type {
  DisplayAttachment,
  MessageAttachment,
} from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';

/** Converts a {@link MessageAttachment} from the API stream into a {@link DisplayAttachment} for rendering. */
export const toDisplayAttachment = (
  attachment: MessageAttachment,
  index: number,
): DisplayAttachment => ({
  id: attachment.url ?? attachment.title ?? String(index),
  name: attachment.title,
  contentType: attachment.type,
  type: attachment.type.startsWith('image/')
    ? AttachmentType.Image
    : AttachmentType.File,
  status: RequestStatus.Idle,
  url: attachment.url,
  previewUrl: attachment.type.startsWith('image/') ? attachment.url : undefined,
});

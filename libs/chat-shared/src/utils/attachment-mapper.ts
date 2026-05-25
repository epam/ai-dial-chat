import { RequestStatus } from '../models/chat.js';
import type { DialAttachment, Attachment } from '../models/chat.js';
import { AttachmentType } from '../types/attachment.js';

/**
 * Converts a `DialAttachment` (DIAL Core API format) to the client-side
 * `Attachment` model used by UI components such as `AttachmentCard` and
 * `AttachmentTray`.
 *
 * Because API attachments carry no real `File` object, a zero-byte stub
 * `File` is created purely to satisfy the `Attachment` shape — it is
 * intended for display only and should never be re-uploaded.
 */
export const mapDialAttachmentToAttachment = (
  dial: DialAttachment,
): Attachment => {
  const isImage = dial.type.startsWith('image/');
  const id = dial.url ?? dial.data ?? dial.title;

  return {
    id,
    name: dial.title,
    contentType: dial.type,
    /** Zero-byte stub — exists only to satisfy the `Attachment` interface. */
    file: new File([], dial.title, { type: dial.type }),
    type: isImage ? AttachmentType.Image : AttachmentType.File,
    status: RequestStatus.Idle,
    ...(isImage && dial.url ? { previewUrl: dial.url } : {}),
  };
};

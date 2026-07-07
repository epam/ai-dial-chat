import type { Attachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { ClipboardEventHandler, useCallback } from 'react';
import { generateAttachmentId } from '../utils/generateAttachmentId';

/**
 * Returns a `handlePaste` handler for a textarea that intercepts clipboard
 * events and converts image items or long plain-text strings into
 * `Attachment` objects instead of inserting raw content.
 *
 * @param onAttachments - Called with the built attachments when a paste is
 *   intercepted.
 * @param threshold - Plain-text pastes longer than this many characters are
 *   converted to a file attachment instead of being inserted inline.
 */
export const useClipboardPaste = (
  onAttachments: (attachments: Attachment[]) => void,
  threshold: number,
): { handlePaste: ClipboardEventHandler<HTMLTextAreaElement> } => {
  const handlePaste: ClipboardEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      if (!event.clipboardData) return;

      const items = Array.from(event.clipboardData.items);
      const imageItems = items.filter(
        (item) => item.kind === 'file' && item.type.startsWith('image/'),
      );
      const hasText = event.clipboardData.getData('text/plain').length > 0;

      if (imageItems.length > 0 && !hasText) {
        const imageAttachments: Attachment[] = [];
        for (const item of imageItems) {
          const blob = item.getAsFile();
          if (!blob) continue;
          const file = new File([blob], 'Screenshot.png', {
            type: blob.type,
          });
          const attachment: Attachment = {
            id: generateAttachmentId(),
            name: 'Screenshot.png',
            contentType: blob.type,
            file,
            type: AttachmentType.Image,
            status: RequestStatus.Idle,
            previewUrl: URL.createObjectURL(file),
          };
          imageAttachments.push(attachment);
        }
        event.preventDefault();
        onAttachments(imageAttachments);
        return;
      }

      const text = event.clipboardData.getData('text/plain');
      if (text.length > threshold) {
        const trimmed = text.trim();
        const MAX_PREVIEW = 80;
        const preview =
          trimmed.length > MAX_PREVIEW
            ? `${trimmed.slice(0, MAX_PREVIEW).trimEnd()}…`
            : trimmed;
        const fileName = preview || 'Pasted text';
        const file = new File([text], fileName, {
          type: 'text/plain',
        });
        const pastedAttachment: Attachment = {
          id: generateAttachmentId(),
          name: fileName,
          contentType: 'text/plain',
          file,
          type: AttachmentType.Pasted,
          status: RequestStatus.Idle,
        };
        event.preventDefault();
        onAttachments([pastedAttachment]);
      }
    },
    [onAttachments, threshold],
  );

  return { handlePaste };
};

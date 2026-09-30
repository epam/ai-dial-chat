import type {
  DisplayAttachment,
  MessageAttachment,
} from '@epam/ai-dial-chat-shared';
import { messageAttachmentsToDisplayAttachments } from '@epam/ai-dial-chat-shared';

/**
 * Maps stage attachments to their display-only model, preferring each
 * attachment's own declared `type` for `contentType` over the type inferred
 * from `reference_url`'s path. A stage attachment's `reference_url` points at
 * the source document a search result was extracted from, not at the
 * attachment's own content, so the generic message-attachment mapper's
 * reference-url-first inference produces the wrong content type here.
 */
export const mapStageAttachmentsToDisplay = (
  attachments?: MessageAttachment[],
): DisplayAttachment[] => {
  const mapped = messageAttachmentsToDisplayAttachments(attachments);
  if (!attachments?.length) return mapped;

  /*
   * First-occurrence-wins, matching `messageAttachmentsToDisplayAttachments`'s
   * own id-based de-duplication — a later attachment sharing an id with an
   * earlier, surviving one must not overwrite the surviving tile's type.
   */
  const declaredTypeById = new Map<string | undefined, string | undefined>();
  for (const dto of attachments) {
    const id = dto.url ?? dto.data ?? dto.title;
    if (!declaredTypeById.has(id)) declaredTypeById.set(id, dto.type);
  }

  return mapped.map((attachment) => {
    const declaredType = declaredTypeById.get(attachment.id);
    return declaredType
      ? { ...attachment, contentType: declaredType }
      : attachment;
  });
};

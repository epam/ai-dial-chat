import type { Conversation } from '@epam/ai-dial-chat-shared';

/** Whether `url` is a DIAL Core file reference (`files/{bucket}/{path}`). */
const isDialFileId = (url: string): boolean => url.startsWith('files/');

/**
 * The reference fields shared by every attachment shape a conversation can
 * carry — `MessageAttachment` on a message or a stage, and
 * `AttachmentResource` on a citation's source.
 */
export interface AttachmentReference {
  /** DIAL file id (`files/{bucket}/{path}`), optionally with a trailing `#…` anchor. */
  url?: string;
  /** Alternate reference resource, same shape as `url`. */
  reference_url?: string;
  /** Display name shown in the UI. */
  title?: string;
}

/**
 * Character set an anchor must stay within to be carried onto a rewritten
 * reference. The only anchor anything here parses is `#page=<digits>`
 * (`PDF_PAGE_REFERENCE_REGEX` in `libs/quotations/src/utils/reference-attachment.ts`);
 * every other reader strips the fragment outright.
 *
 * An imported `.dial` archive is attacker-controllable input, and the anchor
 * from one is re-appended to the upload URL that the import then persists
 * into the conversation. Nothing downstream needs a character outside this
 * set, so a fragment carrying one is dropped rather than stored.
 */
const SAFE_ANCHOR_PATTERN = /^#[\w.=%-]*$/;

/**
 * Splits a DIAL file reference into the resource id and its trailing `#…`
 * anchor (e.g. the `#page=3` a PDF citation carries). An anchor outside
 * {@link SAFE_ANCHOR_PATTERN} is reported as absent; the file id is returned
 * either way, so the attachment itself is still transferred.
 *
 * The anchor is display metadata, not part of the stored resource path: the
 * download endpoint 404s on it, so it has to be stripped before a reference
 * is resolved to `{bucket, path}` — and restored afterwards, so an imported
 * citation still opens the page it cited.
 */
export const splitFileIdAnchor = (
  url: string,
): { fileId: string; anchor: string } => {
  const anchorIndex = url.indexOf('#');
  if (anchorIndex < 0) return { fileId: url, anchor: '' };

  const anchor = url.slice(anchorIndex);
  return {
    fileId: url.slice(0, anchorIndex),
    anchor: SAFE_ANCHOR_PATTERN.test(anchor) ? anchor : '',
  };
};

/** A unique DIAL file reference found in a conversation's messages. */
export interface AttachmentRef {
  fileId: string;
}

/**
 * Visits every attachment a conversation's messages carry, in render order.
 *
 * Reading only `custom_content.attachments` misses the files an agent
 * produces inside an execution stage and the source documents a citation
 * points at, which is how app-generated files usually reach a conversation
 * (issue #8708). The backend's share flow already grants access to all three
 * (`collectConversationResourceUrls` in `apps/chat-api/src/share/share.service.ts`);
 * export and import have to bundle and re-point the same set, or the imported
 * conversation keeps referencing files in the exporting user's bucket.
 */
const forEachAttachmentReference = (
  conversation: Conversation,
  visit: (attachment: AttachmentReference) => void,
): void => {
  for (const message of conversation.messages) {
    const customContent = message.custom_content;
    if (!customContent) continue;

    for (const attachment of customContent.attachments ?? []) {
      visit(attachment);
    }
    for (const stage of customContent.stages ?? []) {
      for (const attachment of stage.attachments ?? []) {
        visit(attachment);
      }
    }
    for (const annotation of customContent.annotations ?? []) {
      const attachment = annotation.body?.source?.attachment;
      if (attachment) visit(attachment);
    }
  }
};

/**
 * Collects unique attachment references across all messages — message
 * attachments, stage attachments, and citation source documents — with any
 * `#…` anchor stripped. The same file can be referenced more than once (by a
 * later turn, by a stage and the message it belongs to, or by several
 * citations), so dedupe by file id and process it only once.
 */
export const collectAttachmentRefs = (
  conversation: Conversation,
): AttachmentRef[] => {
  const fileIds = new Set<string>();

  const addRef = (url: string | undefined): void => {
    if (url == null) return;
    const { fileId } = splitFileIdAnchor(url);
    if (isDialFileId(fileId)) fileIds.add(fileId);
  };

  forEachAttachmentReference(conversation, (attachment) => {
    addRef(attachment.url);
    addRef(attachment.reference_url);
  });

  return Array.from(fileIds, (fileId) => ({ fileId }));
};

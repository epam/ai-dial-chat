import type { Annotation, Conversation } from '@epam/ai-dial-chat-shared';

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

/**
 * Whether a citation-pool entry is an object the transfer helpers may read.
 * The pool is untrusted persisted JSON (an import writes it verbatim), so a
 * `null` or primitive entry is passed through untouched instead of being
 * dereferenced.
 */
const isPoolAnnotation = (entry: unknown): entry is Annotation =>
  entry != null && typeof entry === 'object';

/**
 * Returns the readable entries of the conversation-level citation pool
 * (`customViewState.annotations`, [#9002](https://github.com/epam/ai-dial-chat/issues/9002)), or an empty list when the
 * pool is absent or not an array.
 */
const getAnnotationPool = (conversation: Conversation): Annotation[] => {
  const pool = conversation.customViewState?.['annotations'];
  return Array.isArray(pool) ? pool.filter(isPoolAnnotation) : [];
};

/**
 * Applies `mapAnnotation` to every readable entry of the citation pool,
 * keeping unreadable entries and every other `customViewState` key as they
 * are. Returns `conversation` itself when no entry changed, so a caller can
 * tell by identity that the pool needed no work.
 */
export const mapAnnotationPool = (
  conversation: Conversation,
  mapAnnotation: (annotation: Annotation) => Annotation,
): Conversation => {
  const customViewState = conversation.customViewState;
  const pool = customViewState?.['annotations'];
  if (!Array.isArray(pool)) return conversation;

  let changed = false;
  const annotations = pool.map((entry: unknown) => {
    if (!isPoolAnnotation(entry)) return entry;
    const mapped = mapAnnotation(entry);
    if (mapped !== entry) changed = true;
    return mapped;
  });

  return changed
    ? { ...conversation, customViewState: { ...customViewState, annotations } }
    : conversation;
};

/** A unique DIAL file reference found in a conversation's messages. */
export interface AttachmentRef {
  fileId: string;
}

/**
 * Visits every attachment a conversation carries — its messages' in render
 * order, then the conversation-level citation pool's.
 *
 * Reading only `custom_content.attachments` misses the files an agent
 * produces inside an execution stage and the source documents a citation
 * points at, which is how app-generated files usually reach a conversation
 * ([#8708](https://github.com/epam/ai-dial-chat/issues/8708)). The backend's share flow already grants access to those three
 * (`collectConversationResourceUrls` in `apps/chat-api/src/share/utils/share-resource.util.ts`);
 * export and import have to bundle and re-point the same set, or the imported
 * conversation keeps referencing files in the exporting user's bucket.
 *
 * The pool is visited too: once a message citation loses or changes its
 * source, a `<cit>` resolves from the pool's copy instead, and the pool can
 * cite a file no remaining message does ([#9003](https://github.com/epam/ai-dial-chat/issues/9003)). Visiting it last keeps
 * upload planning — and the ` (n)` suffixes it assigns — unchanged for
 * every message reference.
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

  for (const annotation of getAnnotationPool(conversation)) {
    const attachment = annotation.body?.source?.attachment;
    if (attachment) visit(attachment);
  }
};

/**
 * Collects unique attachment references across all messages — message
 * attachments, stage attachments, and citation source documents — and the
 * conversation-level citation pool, with any
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

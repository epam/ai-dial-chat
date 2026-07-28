import type {
  Conversation,
  ExportFolder,
  ExportFormat,
} from '@epam/ai-dial-chat-shared';

/** Thrown when an imported file cannot be parsed as a supported export envelope. */
export class UnsupportedImportFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedImportFormatError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const SUPPORTED_VERSION = 5;

/**
 * Parses raw file text into a supported export envelope (`version: 5`) with
 * an array `history` — conversations are returned unmodified.
 * Throws `UnsupportedImportFormatError` for malformed JSON or any other shape.
 */
export const parseImportEnvelope = (text: string): ExportFormat => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new UnsupportedImportFormatError('Import file is not valid JSON');
  }

  if (
    !isRecord(parsed) ||
    parsed.version !== SUPPORTED_VERSION ||
    !Array.isArray(parsed.history)
  ) {
    throw new UnsupportedImportFormatError(
      'Import file is not a supported export format',
    );
  }

  const folders: ExportFolder[] = Array.isArray(parsed.folders)
    ? (parsed.folders as ExportFolder[])
    : [];

  return {
    version: SUPPORTED_VERSION,
    history: parsed.history as Conversation[],
    folders,
  };
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Strips a trailing `__<uuid>` segment from a conversation filename, if present. */
const stripTrailingUuid = (fileName: string): string => {
  const lastSepIndex = fileName.lastIndexOf('__');
  if (lastSepIndex < 0) return fileName;
  const candidateUuid = fileName.slice(lastSepIndex + 2);
  return UUID_REGEX.test(candidateUuid)
    ? fileName.slice(0, lastSepIndex)
    : fileName;
};

export interface RebasedConversationId {
  /** The conversation with `id`/`folderId` rebased to `bucket` and a fresh UUID. */
  conversation: Conversation;
  /** Bucket-relative path to pass to `saveConversation`. */
  subPath: string;
}

/**
 * Old chat exports the raw DIAL Core resource id (`conversations/{bucket}/{path}`)
 * as the conversation's `id`/`folderId`, not the app-level `{bucket}/{path}` id
 * the new chat uses. Stripping this prefix — a fixed resource-type literal that
 * can never itself be a bucket name — lets both id shapes resolve to the same
 * `{bucket}/[folders/]{fileName}` structure below.
 */
const RAW_RESOURCE_PREFIX = 'conversations/';

const stripRawResourcePrefix = (path: string): string =>
  path.startsWith(RAW_RESOURCE_PREFIX)
    ? path.slice(RAW_RESOURCE_PREFIX.length)
    : path;

/**
 * Rebases a conversation's id/folderId to the current user's bucket and
 * regenerates its trailing UUID segment, so importing it can never collide
 * with an existing conversation and needs no replace/skip dialog. Folder
 * path segments between the bucket and the filename are preserved (not
 * flattened) — the new chat currently displays everything at the root, but
 * the conversation keeps its original folder location for when the folder
 * feature ships.
 */
export const rebaseConversationId = (
  conversation: Conversation,
  bucket: string,
): RebasedConversationId => {
  const rawId = stripRawResourcePrefix(conversation.id);
  const idSegments = rawId.split('/');
  const oldFolderId = stripRawResourcePrefix(conversation.folderId);
  const oldBucket = idSegments[0];

  const folderSegments = oldFolderId.startsWith(`${oldBucket}/`)
    ? oldFolderId
        .slice(oldBucket.length + 1)
        .split('/')
        .filter(Boolean)
    : [];

  /*
   * Segments after the bucket and any folder sub-paths. For deployments with
   * a path-like id (e.g. `anthropic/claude-3`), the intermediate segments
   * belong to the deployment id prefix and must be preserved in the new path,
   * not dropped as if they were folder segments (issue #7931).
   */
  const pathSegmentsAfterBucket = idSegments.slice(1);
  const pathSegmentsAfterFolder = pathSegmentsAfterBucket.slice(
    folderSegments.length,
  );
  const deploymentPrefixSegments = pathSegmentsAfterFolder.slice(0, -1);
  const oldFileName =
    pathSegmentsAfterFolder.at(-1) ?? idSegments.at(-1) ?? rawId;

  const newFileName = `${stripTrailingUuid(oldFileName)}__${crypto.randomUUID()}`;
  const subPath = [
    ...folderSegments,
    ...deploymentPrefixSegments,
    newFileName,
  ].join('/');
  const newFolderId = folderSegments.length
    ? `${bucket}/${folderSegments.join('/')}`
    : bucket;

  return {
    conversation: {
      ...conversation,
      id: `${bucket}/${subPath}`,
      folderId: newFolderId,
    },
    subPath,
  };
};

/**
 * Derives the queue row's secondary breadcrumb line from a conversation's
 * source `folderId` (`{bucket}[/<folder>/...]`) — the segments after the
 * leading bucket, joined with " / ". Returns `undefined` for a root
 * conversation (no folder segments).
 */
export const getFolderBreadcrumb = (
  conversation: Conversation,
): string | undefined => {
  const segments = stripRawResourcePrefix(conversation.folderId)
    .split('/')
    .filter(Boolean);
  const folderSegments = segments.slice(1);
  return folderSegments.length ? folderSegments.join(' / ') : undefined;
};

/**
 * Formats a list of names for the aggregate success/failure notifications,
 * each individually quoted and comma-separated (e.g. `"A", "B", "C"`) so the
 * i18n template only needs to append the trailing verb phrase.
 */
export const formatQuotedNameList = (names: string[]): string =>
  names.map((name) => `"${name}"`).join(', ');

/**
 * Rewrites every message's attachment `url`/`reference_url` referencing an
 * old file id to its new uploaded location. Attachments not present in
 * `urlMap` are left untouched (immutable — returns a new conversation).
 */
export const rewriteAttachmentUrls = (
  conversation: Conversation,
  urlMap: Map<string, string>,
): Conversation => ({
  ...conversation,
  messages: conversation.messages.map((message) => {
    const attachments = message.custom_content?.attachments;
    if (!attachments?.length) return message;

    return {
      ...message,
      custom_content: {
        ...message.custom_content,
        attachments: attachments.map((attachment) => {
          const newUrl = attachment.url
            ? urlMap.get(attachment.url)
            : undefined;
          const newReferenceUrl = attachment.reference_url
            ? urlMap.get(attachment.reference_url)
            : undefined;
          if (newUrl == null && newReferenceUrl == null) return attachment;

          return {
            ...attachment,
            ...(newUrl != null ? { url: newUrl } : {}),
            ...(newReferenceUrl != null
              ? { reference_url: newReferenceUrl }
              : {}),
          };
        }),
      },
    };
  }),
});

import type {
  Conversation,
  ExportFolder,
  ExportFormat,
} from '@epam/ai-dial-chat-shared';
import { collectAttachmentRefs } from './attachment-refs';
import type {
  AllocatedUploadPath,
  UploadPathAllocator,
} from './build-upload-path';
import { resolveDialFileBucketAndPath } from './dial-file';

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

/** New location — and, when the import renamed it, new display name — for an imported attachment. */
export interface RewrittenAttachmentTarget {
  /** New `files/{bucket}/{path}` id to write into `url`/`reference_url`. */
  url: string;
  /** New display name — present only when a ` (n)` disambiguation suffix was applied. */
  title?: string;
}

/**
 * Rewrites every message's attachment `url`/`reference_url` referencing an
 * old file id to its new uploaded location, and its `title` when the target
 * carries a renamed one. Attachments not present in `targetMap` are left
 * untouched (immutable — returns a new conversation).
 */
export const rewriteAttachmentUrls = (
  conversation: Conversation,
  targetMap: Map<string, RewrittenAttachmentTarget>,
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
          const urlTarget = attachment.url
            ? targetMap.get(attachment.url)
            : undefined;
          const referenceTarget = attachment.reference_url
            ? targetMap.get(attachment.reference_url)
            : undefined;
          if (urlTarget == null && referenceTarget == null) return attachment;

          const newTitle = urlTarget?.title ?? referenceTarget?.title;
          return {
            ...attachment,
            ...(urlTarget != null ? { url: urlTarget.url } : {}),
            ...(referenceTarget != null
              ? { reference_url: referenceTarget.url }
              : {}),
            ...(newTitle != null ? { title: newTitle } : {}),
          };
        }),
      },
    };
  }),
});

/** Best-effort display name for a fileId that failed to resolve to a `{bucket, path}` pair. */
export const fileIdDisplayName = (fileId: string): string =>
  fileId.split('/').pop() || fileId;

/** One attachment reference planned for upload, with its collision-free destination already allocated. */
export interface PlannedAttachmentUpload {
  /** Original DIAL file id this attachment is uploaded from — the key `rewriteAttachmentUrls` rewrites. */
  fileId: string;
  /** Raw bytes read from the archive. */
  bytes: Uint8Array;
  /** Basename a 409 retry re-derives its next attempt from (never the already-suffixed name). */
  originalFileName: string;
  /** Destination allocated for the first upload attempt. */
  allocated: AllocatedUploadPath;
}

/**
 * Resolves a conversation's unique attachment references to archive bytes
 * and allocates each a collision-free upload destination, in
 * `collectAttachmentRefs` order — a synchronous pre-pass so suffix
 * assignment stays deterministic regardless of later upload concurrency.
 * A reference that cannot be resolved to a `{bucket, path}` pair, or has no
 * matching bytes in the archive, is reported in `skippedNames` and does not
 * consume an allocator slot.
 */
export const planAttachmentUploads = (
  conversation: Conversation,
  attachmentBytes: Map<string, Uint8Array>,
  allocator: UploadPathAllocator,
): { plan: PlannedAttachmentUpload[]; skippedNames: string[] } => {
  const plan: PlannedAttachmentUpload[] = [];
  const skippedNames: string[] = [];

  for (const ref of collectAttachmentRefs(conversation)) {
    const resolved = resolveDialFileBucketAndPath(ref.fileId);
    if (!resolved) {
      skippedNames.push(fileIdDisplayName(ref.fileId));
      continue;
    }

    const fileName = resolved.path.split('/').pop() ?? resolved.path;
    const bytes = attachmentBytes.get(resolved.path);
    if (!bytes) {
      skippedNames.push(fileName);
      continue;
    }

    plan.push({
      fileId: ref.fileId,
      bytes,
      originalFileName: fileName,
      allocated: allocator.allocate(fileName),
    });
  }

  return { plan, skippedNames };
};

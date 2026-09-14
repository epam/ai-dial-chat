import {
  generateUUID,
  sanitizeConversationName,
  stripTrailingDots,
  truncateToUtf8Bytes,
} from '@epam/ai-dial-chat-shared';
import type {
  Annotation,
  Conversation,
  ExportFolder,
  ExportFormat,
  Stage,
} from '@epam/ai-dial-chat-shared';
import { collectAttachmentRefs, splitFileIdAnchor } from './attachment-refs';
import type { AttachmentReference } from './attachment-refs';
import type {
  AllocatedUploadPath,
  UploadPathAllocator,
} from './build-upload-path';
import { resolveDialFileBucketAndPath } from './dial-file-resolve';

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

/** Separator between the deployment id, the title, and the trailing uuid of a conversation filename. */
const CONVERSATION_NAME_SEPARATOR = '__';
/** Max byte length DIAL Core accepts for a conversation title, matching the rename input limit. */
const CONVERSATION_TITLE_MAX_BYTES = 255;
/**
 * Only custom applications carry a `{name}__{version}` deployment id, so a
 * purely numeric title (`"1.0"`) must not be mistaken for a version suffix
 * outside an `applications/` path.
 */
const APPLICATIONS_PATH_SEGMENT = 'applications';
const VERSION_METADATA_SEPARATOR_REGEX = /[-+]/;
const VERSION_NUMBER_PART_REGEX = /^\d+$/;

const isDeploymentVersionSuffix = (value?: string): boolean => {
  if (!value) return false;

  return value
    .split(VERSION_METADATA_SEPARATOR_REGEX)[0]
    .split('.')
    .every((part) => VERSION_NUMBER_PART_REGEX.test(part));
};

/**
 * Reduces a conversation `name` to a single filename-safe title segment,
 * mirroring the backend's `prepareEntityName`: the first non-empty line with
 * every character DIAL Core rejects in a resource name removed, truncated to
 * `CONVERSATION_TITLE_MAX_BYTES` and stripped of trailing dots. Returns an
 * empty string when nothing usable is left.
 */
const sanitizeImportedTitle = (name: string): string => {
  const firstLine =
    name
      .replace(/\r\n|\r/g, '\n')
      .split('\n')
      .map((line) => sanitizeConversationName(line).trim())
      .filter(Boolean)[0] ?? '';

  return stripTrailingDots(
    truncateToUtf8Bytes(firstLine, CONVERSATION_TITLE_MAX_BYTES),
  ).trimEnd();
};

/**
 * Rebuilds a conversation filename as `{deploymentId}__{title}__{uuid}`, with
 * a fresh uuid and `title` as the title segment.
 *
 * Both old- and new-chat exports embed the conversation's *initial*,
 * first-message-derived title in the filename and keep the current one (LLM
 * named or manually renamed) only in the body's `name`. The conversation list
 * derives each row's title from the stored filename and reads `name` back for
 * a bounded number of the most recently updated items only, so importing more
 * conversations than that budget left the older ones displayed under a title
 * bearing no resemblance to the one the user exported — they looked as though
 * they had never been imported (issue #8668). Writing the authoritative name
 * into the filename keeps both in agreement for every imported conversation,
 * no matter how many the file carries.
 *
 * `title` falls back to the source filename's own title segment when the
 * conversation's `name` sanitizes to nothing.
 */
const buildImportedFileName = (
  oldFileName: string,
  title: string,
  isApplicationDeployment: boolean,
): string => {
  const parts = oldFileName.split(CONVERSATION_NAME_SEPARATOR);
  /*
   * No separator at all — nothing marks where a deployment id ends and a
   * title begins, so the filename is left as it is and only re-suffixed.
   */
  if (parts.length < 2) {
    return [oldFileName, generateUUID()].join(CONVERSATION_NAME_SEPARATOR);
  }

  const deploymentParts =
    isApplicationDeployment && isDeploymentVersionSuffix(parts[1])
      ? parts.slice(0, 2)
      : parts.slice(0, 1);
  const hasTrailingUuid =
    deploymentParts.length > 1
      ? UUID_REGEX.test(parts[parts.length - 1])
      : parts.length >= 3;
  const oldTitle = parts
    .slice(deploymentParts.length, hasTrailingUuid ? -1 : undefined)
    .join(CONVERSATION_NAME_SEPARATOR);

  return [...deploymentParts, title || oldTitle, generateUUID()].join(
    CONVERSATION_NAME_SEPARATOR,
  );
};

export interface RebasedConversationId {
  /** The conversation with `id`/`folderId` rebased to `bucket` and a fresh UUID, and `name` sanitized. */
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
 *
 * The filename's title segment is rewritten from the conversation's own
 * `name` (see `buildImportedFileName`), and `name` is replaced with the same
 * sanitized value — the invariant the conversation list relies on to render a
 * row's title identically whether or not it read the body back.
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

  const pathSegmentsBeforeFileName = [
    ...folderSegments,
    ...deploymentPrefixSegments,
  ];
  const importedTitle = sanitizeImportedTitle(conversation.name);
  const newFileName = buildImportedFileName(
    oldFileName,
    importedTitle,
    pathSegmentsBeforeFileName[0] === APPLICATIONS_PATH_SEGMENT,
  );
  const subPath = [...pathSegmentsBeforeFileName, newFileName].join('/');
  const newFolderId = folderSegments.length
    ? `${bucket}/${folderSegments.join('/')}`
    : bucket;

  return {
    conversation: {
      ...conversation,
      ...(importedTitle ? { name: importedTitle } : {}),
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
 * Resolves one reference against `targetMap`, matching on the file id alone
 * and carrying any `#…` anchor (e.g. a citation's `#page=3`) over to the new
 * location, so an imported citation still opens the page it cited.
 */
const resolveRewrittenTarget = (
  url: string | undefined,
  targetMap: Map<string, RewrittenAttachmentTarget>,
): RewrittenAttachmentTarget | undefined => {
  if (!url) return undefined;
  const { fileId, anchor } = splitFileIdAnchor(url);
  const target = targetMap.get(fileId);
  if (target == null) return undefined;
  return { ...target, url: `${target.url}${anchor}` };
};

/**
 * Returns the `url`/`reference_url`/`title` fields to overwrite on one
 * attachment, or `undefined` when neither of its references was uploaded.
 * Returning a patch rather than a whole attachment keeps the caller's own
 * shape (a `MessageAttachment` or a citation's `AttachmentResource`) intact.
 */
const buildAttachmentPatch = (
  attachment: AttachmentReference,
  targetMap: Map<string, RewrittenAttachmentTarget>,
): AttachmentReference | undefined => {
  const urlTarget = resolveRewrittenTarget(attachment.url, targetMap);
  const referenceTarget = resolveRewrittenTarget(
    attachment.reference_url,
    targetMap,
  );
  if (urlTarget == null && referenceTarget == null) return undefined;

  const newTitle = urlTarget?.title ?? referenceTarget?.title;
  return {
    ...(urlTarget != null ? { url: urlTarget.url } : {}),
    ...(referenceTarget != null ? { reference_url: referenceTarget.url } : {}),
    ...(newTitle != null ? { title: newTitle } : {}),
  };
};

/** Rewrites the attachments an agent produced inside each execution stage. */
const rewriteStages = (
  stages: Stage[],
  targetMap: Map<string, RewrittenAttachmentTarget>,
): Stage[] =>
  stages.map((stage) =>
    stage.attachments?.length
      ? {
          ...stage,
          attachments: stage.attachments.map((attachment) => {
            const patch = buildAttachmentPatch(attachment, targetMap);
            return patch ? { ...attachment, ...patch } : attachment;
          }),
        }
      : stage,
  );

/** Rewrites the source document each citation points at. */
const rewriteAnnotations = (
  annotations: Annotation[],
  targetMap: Map<string, RewrittenAttachmentTarget>,
): Annotation[] =>
  annotations.map((annotation) => {
    const source = annotation.body?.source;
    if (source?.attachment == null) return annotation;

    const patch = buildAttachmentPatch(source.attachment, targetMap);
    if (patch == null) return annotation;

    return {
      ...annotation,
      body: {
        ...annotation.body,
        source: {
          ...source,
          attachment: { ...source.attachment, ...patch },
        },
      },
    };
  });

/**
 * Rewrites every attachment reference a message carries — its own
 * `custom_content.attachments`, the attachments of each execution stage, and
 * the source document of each citation — from an old file id to its new
 * uploaded location, and its `title` when the target carries a renamed one.
 * References not present in `targetMap` are left untouched (immutable —
 * returns a new conversation).
 */
export const rewriteAttachmentUrls = (
  conversation: Conversation,
  targetMap: Map<string, RewrittenAttachmentTarget>,
): Conversation => ({
  ...conversation,
  messages: conversation.messages.map((message) => {
    const customContent = message.custom_content;
    if (!customContent) return message;

    const { attachments, stages, annotations } = customContent;
    if (!attachments?.length && !stages?.length && !annotations?.length) {
      return message;
    }

    return {
      ...message,
      custom_content: {
        ...customContent,
        ...(attachments?.length
          ? {
              attachments: attachments.map((attachment) => {
                const patch = buildAttachmentPatch(attachment, targetMap);
                return patch ? { ...attachment, ...patch } : attachment;
              }),
            }
          : {}),
        ...(stages?.length ? { stages: rewriteStages(stages, targetMap) } : {}),
        ...(annotations?.length
          ? { annotations: rewriteAnnotations(annotations, targetMap) }
          : {}),
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

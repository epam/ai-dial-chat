import { safeDecodeURIComponent } from '../../common/utils/uri';
import { PUBLIC_BUCKET } from '../../constants/dial.constants';
import {
  getPublishedAttachmentsFolderUrl,
  getResourceBucket,
} from '../../publish/publish-target.util';

const FILE_RESOURCE_PREFIX = 'files/';

/** Prefix of the legacy folder attachment form (`type: application/vnd.dial.metadata+json`) that DIAL Core also recognises. */
const METADATA_PREFIX = 'metadata/';

interface AnnotationWithAttachment {
  body?: {
    source?: {
      attachment?: unknown;
    };
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const collectAttachmentValues = (
  attachments: unknown,
  values: string[],
): void => {
  if (!Array.isArray(attachments)) return;

  for (const attachment of attachments) {
    if (!isRecord(attachment)) continue;

    for (const field of ['url', 'reference_url'] as const) {
      const value = attachment[field];
      if (typeof value === 'string') values.push(value);
    }
  }
};

/**
 * Every `url` and `reference_url` string a conversation's messages carry, in
 * first-seen order and without any filtering: message attachments, execution
 * stage attachments and citation source attachments. Share and publish both
 * start from this list, and each applies its own policy to it.
 * @param conversation - a stored conversation body
 */
export const collectConversationAttachmentUrls = (
  conversation: unknown,
): string[] => {
  if (!isRecord(conversation) || !Array.isArray(conversation.messages)) {
    return [];
  }

  const values: string[] = [];
  for (const message of conversation.messages) {
    if (!isRecord(message) || !isRecord(message.custom_content)) continue;

    collectAttachmentValues(message.custom_content.attachments, values);

    const stages = message.custom_content.stages;
    if (Array.isArray(stages)) {
      for (const stage of stages) {
        if (isRecord(stage)) {
          collectAttachmentValues(stage.attachments, values);
        }
      }
    }

    const annotations = message.custom_content.annotations;
    if (!Array.isArray(annotations)) continue;
    for (const annotation of annotations) {
      const attachment = (annotation as AnnotationWithAttachment)?.body?.source
        ?.attachment;
      collectAttachmentValues([attachment], values);
    }
  }

  return values;
};

/** A folder attachment url split into its optional legacy prefix and the `files/{bucket}/…/` folder url. */
export interface FolderAttachmentUrl {
  metadataPrefix: '' | typeof METADATA_PREFIX;
  folderUrl: string;
}

/**
 * Reads `url` as a folder attachment: `files/{bucket}/…/`, or the legacy
 * `metadata/files/{bucket}/…/` form. A url without a trailing slash is a file.
 * @param url - an attachment `url`
 * @returns the parsed folder, or `undefined` when `url` is not a folder url
 */
export const parseFolderAttachmentUrl = (
  url: unknown,
): FolderAttachmentUrl | undefined => {
  if (typeof url !== 'string') return undefined;

  const hasMetadataPrefix = url.startsWith(METADATA_PREFIX);
  const folderUrl = hasMetadataPrefix ? url.slice(METADATA_PREFIX.length) : url;
  if (!folderUrl.startsWith(FILE_RESOURCE_PREFIX) || !folderUrl.endsWith('/')) {
    return undefined;
  }

  return {
    metadataPrefix: hasMetadataPrefix ? METADATA_PREFIX : '',
    folderUrl,
  };
};

const isTraversalUrl = (url: string): boolean =>
  safeDecodeURIComponent(url).split('/').includes('..');

const isInBucket = (url: string, bucket: string): boolean =>
  safeDecodeURIComponent(getResourceBucket(url)) ===
  safeDecodeURIComponent(bucket);

/** The attachment files and folders of a conversation that live in one bucket. */
export interface OwnedAttachmentRefs {
  /** `files/{bucket}/…` file urls, fragments removed, unique, first-seen order. */
  fileUrls: string[];
  /** `files/{bucket}/…/` folder urls (legacy prefix removed), unique, first-seen order. */
  folderUrls: string[];
}

/**
 * Splits the file and folder attachments of a conversation and keeps only
 * those in `bucket`. A reference into another user's bucket or the public
 * bucket is omitted (it cannot be published by this user), and so is anything
 * with a `..` segment. Inline `data` attachments and external urls never match.
 * @param conversation - a stored conversation body
 * @param bucket - the author's own bucket
 */
export const collectOwnedAttachmentRefs = (
  conversation: unknown,
  bucket: string,
): OwnedAttachmentRefs => {
  const fileUrls = new Set<string>();
  const folderUrls = new Set<string>();

  for (const value of collectConversationAttachmentUrls(conversation)) {
    const folder = parseFolderAttachmentUrl(value);
    if (folder != null) {
      if (isInBucket(folder.folderUrl, bucket) && !isTraversalUrl(value)) {
        folderUrls.add(folder.folderUrl);
      }
      continue;
    }

    const fileUrl = value.split('#', 1)[0];
    if (
      fileUrl.startsWith(FILE_RESOURCE_PREFIX) &&
      !fileUrl.endsWith('/') &&
      isInBucket(fileUrl, bucket) &&
      !isTraversalUrl(fileUrl)
    ) {
      fileUrls.add(fileUrl);
    }
  }

  return { fileUrls: [...fileUrls], folderUrls: [...folderUrls] };
};

/**
 * The published counterpart of a folder attachment url:
 * `files/{bucket}/docs/` -> `files/public/{folder}/{name}/docs/`.
 * @param folderUrl - `files/{bucket}/…/`
 * @param publishedConversationUrl - `conversations/public/{folder}/{name}`, encoded
 * @returns the published folder url, or `undefined` for a folder already in the public bucket
 */
export const toPublishedFolderUrl = (
  folderUrl: string,
  publishedConversationUrl: string,
): string | undefined => {
  const [, bucket, ...path] = folderUrl.split('/');
  if (bucket == null || bucket === PUBLIC_BUCKET) return undefined;

  return `${getPublishedAttachmentsFolderUrl(publishedConversationUrl)}${path.join('/')}`;
};

/**
 * Returns `conversation` with every message folder attachment rewritten to its
 * published folder, when that folder exists. DIAL Core rewrites the links of
 * published *files* itself but never a folder link, so the published copy
 * keeps pointing at the author's private bucket; this is what makes the folder
 * readable for everyone else. A folder whose published counterpart does not
 * exist (never published, empty, published before attachments were) keeps its
 * url. The legacy `metadata/` prefix is preserved. The input is not mutated.
 * @param conversation - a conversation read from the public bucket
 * @param publishedConversationUrl - `conversations/public/{folder}/{name}`, encoded
 * @param folderExists - whether a published folder url holds any file
 */
export const resolvePublishedFolderAttachments = async <T>(
  conversation: T,
  publishedConversationUrl: string,
  folderExists: (publishedFolderUrl: string) => Promise<boolean>,
): Promise<T> => {
  if (!isRecord(conversation) || !Array.isArray(conversation.messages)) {
    return conversation;
  }

  const existence = new Map<string, Promise<boolean>>();
  const exists = (publishedFolderUrl: string): Promise<boolean> => {
    let result = existence.get(publishedFolderUrl);
    if (result == null) {
      result = folderExists(publishedFolderUrl);
      existence.set(publishedFolderUrl, result);
    }
    return result;
  };

  let changed = false;
  const messages = await Promise.all(
    conversation.messages.map(async (message: unknown) => {
      if (!isRecord(message) || !isRecord(message.custom_content)) {
        return message;
      }
      const attachments = message.custom_content.attachments;
      if (!Array.isArray(attachments)) return message;

      let messageChanged = false;
      const resolved = await Promise.all(
        attachments.map(async (attachment: unknown) => {
          if (!isRecord(attachment)) return attachment;
          const folder = parseFolderAttachmentUrl(attachment.url);
          if (folder == null) return attachment;

          const publishedUrl = toPublishedFolderUrl(
            folder.folderUrl,
            publishedConversationUrl,
          );
          if (publishedUrl == null || !(await exists(publishedUrl))) {
            return attachment;
          }

          messageChanged = true;
          return {
            ...attachment,
            url: `${folder.metadataPrefix}${publishedUrl}`,
          };
        }),
      );
      if (!messageChanged) return message;

      changed = true;
      return {
        ...message,
        custom_content: { ...message.custom_content, attachments: resolved },
      };
    }),
  );

  return changed ? ({ ...conversation, messages } as T) : conversation;
};

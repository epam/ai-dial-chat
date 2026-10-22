import { safeDecodeURIComponent } from '../../common/utils/uri';
import { PUBLIC_BUCKET } from '../../constants/dial.constants';
import {
  getPublishedAttachmentsFolderUrl,
  getResourceBucket,
} from '../../publish/publish-target.util';

const FILE_RESOURCE_PREFIX = 'files/';

/** Published copies looked up in one round of parallel requests, so a conversation with many citations cannot flood DIAL Core. */
const EXISTENCE_LOOKUP_CONCURRENCY = 8;

/** Prefix of the legacy folder attachment form (`type: application/vnd.dial.metadata+json`) that DIAL Core also recognises. */
const METADATA_PREFIX = 'metadata/';

/** The fields of an attachment that can point at a DIAL file or folder; `type` and `title` are shared by every attachment shape. */
export interface AttachmentRef {
  type?: string;
  title?: string;
  url?: string;
  reference_url?: string;
}

/** A citation: the attachment of `body.source` is the cited file. */
export interface AnnotationView {
  body?: { source?: { attachment?: AttachmentRef } };
}

/** The part of a message that carries attachment references. */
export interface MessageCustomContentView {
  attachments?: AttachmentRef[];
  stages?: Array<{ attachments?: AttachmentRef[] }>;
  annotations?: AnnotationView[];
}

/** The minimal shape of a stored conversation this module reads and rewrites. */
export interface ConversationAttachmentView {
  messages?: Array<{ custom_content?: MessageCustomContentView }>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const URL_FIELDS = ['url', 'reference_url'] as const;

const mapAttachmentRef = <A extends AttachmentRef>(
  attachment: A,
  map: (value: string) => string,
): A => {
  if (!isRecord(attachment)) return attachment;

  let result = attachment;
  for (const field of URL_FIELDS) {
    const value = attachment[field];
    if (typeof value !== 'string') continue;

    const mapped = map(value);
    if (mapped !== value) result = { ...result, [field]: mapped };
  }
  return result;
};

const mapList = <T>(
  list: T[] | undefined,
  map: (item: T) => T,
): T[] | undefined => {
  if (!Array.isArray(list)) return list;

  const mapped = list.map(map);
  return mapped.some((item, index) => item !== list[index]) ? mapped : list;
};

const mapCustomContent = <C extends MessageCustomContentView>(
  content: C,
  map: (value: string) => string,
): C => {
  const mapRefs = (refs: AttachmentRef[] | undefined) =>
    mapList(refs, (ref) => mapAttachmentRef(ref, map));

  const attachments = mapRefs(content.attachments);
  const stages = mapList(content.stages, (stage) => {
    if (!isRecord(stage)) return stage;
    const stageAttachments = mapRefs(stage.attachments);
    return stageAttachments === stage.attachments
      ? stage
      : { ...stage, attachments: stageAttachments };
  });
  const annotations = mapList(content.annotations, (annotation) => {
    const body = annotation?.body;
    const source = body?.source;
    const attachment = source?.attachment;
    if (!isRecord(attachment) || !body || !source) return annotation;

    const mapped = mapAttachmentRef(attachment, map);
    return mapped === attachment
      ? annotation
      : {
          ...annotation,
          body: { ...body, source: { ...source, attachment: mapped } },
        };
  });

  if (
    attachments === content.attachments &&
    stages === content.stages &&
    annotations === content.annotations
  ) {
    return content;
  }
  return {
    ...content,
    ...(attachments !== content.attachments && { attachments }),
    ...(stages !== content.stages && { stages }),
    ...(annotations !== content.annotations && { annotations }),
  };
};

/**
 * Applies `map` to every `url` and `reference_url` string a conversation's
 * messages carry: message attachments, execution stage attachments and
 * citation source attachments, in that order per message. The one definition
 * of where attachment references live, shared by collecting them (publish,
 * share) and rewriting them (published read, duplicate). Only the parts that
 * change are copied; the input is not mutated and is returned as is when
 * nothing changes. Malformed parts of an untrusted payload are skipped.
 * @param conversation - a stored conversation body
 * @param map - returns the value to keep for a reference string
 */
export const mapConversationAttachmentFields = <
  C extends ConversationAttachmentView,
>(
  conversation: C,
  map: (value: string) => string,
): C => {
  if (!isRecord(conversation) || !Array.isArray(conversation.messages)) {
    return conversation;
  }

  const messages = mapList(conversation.messages, (message) => {
    if (!isRecord(message) || !isRecord(message.custom_content)) {
      return message;
    }
    const customContent = mapCustomContent(message.custom_content, map);
    return customContent === message.custom_content
      ? message
      : { ...message, custom_content: customContent };
  });

  return messages === conversation.messages
    ? conversation
    : { ...conversation, messages };
};

/**
 * Every `url` and `reference_url` string a conversation's messages carry, in
 * first-seen order and without any filtering. Share and publish both start
 * from this list, and each applies its own policy to it.
 * @param conversation - a stored conversation body
 */
export const collectConversationAttachmentUrls = (
  conversation: unknown,
): string[] => {
  const values: string[] = [];
  if (!isRecord(conversation)) return values;

  mapConversationAttachmentFields(conversation, (value) => {
    values.push(value);
    return value;
  });
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

const stripFragment = (url: string): string => url.split('#', 1)[0];

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
 * with a `..` segment. Fragments are dropped, and inline `data` attachments
 * and external urls never match.
 * @param conversation - a stored conversation body
 * @param bucket - the author's own bucket
 */
export const collectOwnedAttachmentRefs = (
  conversation: ConversationAttachmentView,
  bucket: string,
): OwnedAttachmentRefs => {
  const fileUrls = new Set<string>();
  const folderUrls = new Set<string>();

  for (const value of collectConversationAttachmentUrls(conversation)) {
    const folder = parseFolderAttachmentUrl(stripFragment(value));
    if (folder != null) {
      if (isInBucket(folder.folderUrl, bucket) && !isTraversalUrl(value)) {
        folderUrls.add(folder.folderUrl);
      }
      continue;
    }

    const fileUrl = stripFragment(value);
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

/** An attachment reference that may have been published, split into the parts a rewrite keeps. */
interface PublishableReference {
  /** `metadata/` for the legacy folder form, otherwise empty. */
  metadataPrefix: FolderAttachmentUrl['metadataPrefix'];
  /** `files/{bucket}/…`, a trailing `/` marking a folder. */
  resourceUrl: string;
  /** `#…` suffix kept verbatim, or empty. */
  fragment: string;
}

const parsePublishableReference = (
  value: string,
): PublishableReference | undefined => {
  const fragmentStart = value.indexOf('#');
  const fragment = fragmentStart === -1 ? '' : value.slice(fragmentStart);
  const base = fragmentStart === -1 ? value : value.slice(0, fragmentStart);

  const folder = parseFolderAttachmentUrl(base);
  const metadataPrefix = folder?.metadataPrefix ?? '';
  const resourceUrl = folder?.folderUrl ?? base;
  if (!resourceUrl.startsWith(FILE_RESOURCE_PREFIX) || isTraversalUrl(base)) {
    return undefined;
  }

  return { metadataPrefix, resourceUrl, fragment };
};

/**
 * The published counterpart of a private attachment reference. The source
 * bucket is kept as a path segment, so a file or folder of one bucket can
 * only ever map to what was published from that same bucket:
 * `files/{bucket}/docs/` -> `files/public/{folder}/{name}/{bucket}/docs/`.
 * @param resourceUrl - `files/{bucket}/…`, a trailing `/` for a folder
 * @param publishedConversationUrl - `conversations/public/{folder}/{name}`, encoded
 * @returns the published url, or `undefined` for a reference with no bucket or already in the public bucket
 */
export const toPublishedAttachmentUrl = (
  resourceUrl: string,
  publishedConversationUrl: string,
): string | undefined => {
  const [, bucket, ...path] = resourceUrl.split('/');
  if (!bucket || path.length === 0 || bucket === PUBLIC_BUCKET) {
    return undefined;
  }

  return `${getPublishedAttachmentsFolderUrl(publishedConversationUrl)}${bucket}/${path.join('/')}`;
};

/**
 * Returns `conversation` with every attachment reference (message, stage and
 * citation `url` / `reference_url`) rewritten to the copy published with the
 * conversation, when that copy exists. DIAL Core rewrites only the `url` of
 * published message attachment *files* and never a folder link, so every
 * other reference keeps pointing at the author's private bucket; this is what
 * makes them readable for everyone else. A reference whose published
 * counterpart does not exist (never published, another user's bucket,
 * published before attachments were) keeps its url. The `metadata/` prefix and
 * any `#fragment` are preserved. The input is not mutated.
 * @param conversation - a conversation read from the public bucket
 * @param publishedConversationUrl - `conversations/public/{folder}/{name}`, encoded
 * @param exists - whether a published file (or, with a trailing `/`, folder holding any file) exists; a failed lookup must reject, not resolve `false`
 * @throws whatever `exists` rejects with
 */
export const resolvePublishedAttachments = async <
  C extends ConversationAttachmentView,
>(
  conversation: C,
  publishedConversationUrl: string,
  exists: (publishedUrl: string) => Promise<boolean>,
): Promise<C> => {
  const candidates = new Map<string, PublishableReference & { url: string }>();
  for (const value of collectConversationAttachmentUrls(conversation)) {
    const reference = parsePublishableReference(value);
    const url =
      reference &&
      toPublishedAttachmentUrl(reference.resourceUrl, publishedConversationUrl);
    if (reference && url) candidates.set(value, { ...reference, url });
  }
  if (candidates.size === 0) return conversation;

  const publishedUrls = [
    ...new Set([...candidates.values()].map((reference) => reference.url)),
  ];
  const existence = new Map<string, boolean>();
  for (
    let start = 0;
    start < publishedUrls.length;
    start += EXISTENCE_LOOKUP_CONCURRENCY
  ) {
    const batch = publishedUrls.slice(
      start,
      start + EXISTENCE_LOOKUP_CONCURRENCY,
    );
    const answers = await Promise.all(batch.map((url) => exists(url)));
    batch.forEach((url, index) => existence.set(url, answers[index]));
  }

  const replacements = new Map<string, string>();
  for (const [value, reference] of candidates) {
    if (existence.get(reference.url)) {
      replacements.set(
        value,
        `${reference.metadataPrefix}${reference.url}${reference.fragment}`,
      );
    }
  }

  return mapConversationAttachmentFields(
    conversation,
    (value) => replacements.get(value) ?? value,
  );
};

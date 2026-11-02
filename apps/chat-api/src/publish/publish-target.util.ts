import { encodePlainDialResourcePath } from '../common/utils/encode-dial-path';
import { safeDecodeURIComponent } from '../common/utils/uri';

/*
 * Confirmed against DIAL Core's own OpenAPI spec (`/v1/ops/publication/create`
 * documented example, https://dialx.ai/dial_api#tag/Publications/operation/createPublication):
 *
 *   targetFolder: public/folder/
 *   resources:
 *     - sourceUrl: conversations/{bucket}/my/folder/conversation
 *       targetUrl: conversations/public/folder/conversation
 *
 * `targetFolder` is `public/{folderPath}/` — REQUIRES a trailing slash (a
 * prior fix omitted it, which is what Core's `must start with: public and
 * ends with: /` 400 was actually complaining about). `targetUrl` IS a full
 * destination file path — `{resourceTypePrefix}/{targetFolder}{resourceName}`
 * — contrary to an earlier (incorrect) live-debugging conclusion that it
 * had to be folder-shaped; that conclusion was based on misreading which
 * field the error referred to. There is no opaque per-org bucket-id hash —
 * the shared Organization/public area is addressed by the literal segment
 * `public` (also matches the legacy pre-BFF frontend's `PUBLIC_URL_PREFIX`
 * in `apps/chat/src/constants/publication.ts` on `origin/development`).
 *
 * Shared by `publish.service.ts` (catalog entities) and
 * `conversation-publish.service.ts` (conversations) — both proxy the same
 * DIAL Core Publication API and address the same `public/` bucket.
 */
export const PUBLIC_URL_PREFIX = 'public';

/** `entityId`'s first path segment, e.g. `applications` in `applications/{bucket}/{name}`. */
export const getResourceTypePrefix = (entityId: string): string =>
  entityId.split('/')[0];

/** `entityId`'s second path segment, e.g. `{bucket}` in `applications/{bucket}/{name}`. */
export const getResourceBucket = (entityId: string): string =>
  entityId.split('/')[1];

/** `entityId`'s last path segment, e.g. `{name}` in `applications/{bucket}/{name}`. */
export const getResourceName = (entityId: string): string =>
  entityId.split('/').pop() ?? entityId;

/**
 * `getPublications`'s `ResourceLink.url` is a list **scope** (confirmed
 * against DIAL Core's OpenAPI spec — `publications/{bucket}/` for a user's
 * own submissions), not a per-resource filter — there is no request field
 * that narrows results to a single entity/conversation. Passing the
 * resource's own url there (an earlier version of both publish services did)
 * gets rejected by Core with a 400 ("Invalid request to DIAL Core"). Callers
 * must fetch this bucket-wide scope and filter the response client-side by
 * `resources[].sourceUrl` themselves.
 */
export const getPublicationsListScope = (bucket: string): string =>
  `publications/${bucket}/`;

/**
 * `public/{folderPath}/`, always trailing-slashed (bare `public/` at the
 * root). `folderPath` arrives as plain, unencoded text (e.g. `"test 14.04"`)
 * from the request body, but DIAL Core rejects resource urls containing raw
 * spaces/special characters (`Bad resource url: public/test 14.04/`) — so
 * every segment is percent-encoded.
 *
 * The encoder is `encodePlainDialResourcePath`, **not** the idempotent
 * `encodeDialResourcePath` every other DIAL resource path uses. That one
 * decodes each segment before encoding it, which is lossy for a plain folder
 * name that legitimately contains a percent escape: a folder literally named
 * `test%20folder` decoded to `test folder`, so the published copy landed in a
 * folder of that name and the skill card's breadcrumb showed a space
 * ([#8974](https://github.com/epam/ai-dial-chat/issues/8974)). Encoding without the pre-decode sends
 * `public/test%2520folder/`, which Core stores back under the author's
 * literal name.
 */
export const getPublicTargetFolder = (folderPath: string): string =>
  folderPath
    ? `${PUBLIC_URL_PREFIX}/${encodePlainDialResourcePath(folderPath)}/`
    : `${PUBLIC_URL_PREFIX}/`;

/** Strips the leading `public/` segment and trailing slash DIAL Core returns in `Publication.targetFolder`, decoding each segment back to the plain folder path the frontend works with. */
export const stripPublicTargetFolder = (targetFolder: string): string => {
  const prefix = `${PUBLIC_URL_PREFIX}/`;
  const withoutPrefix = targetFolder.startsWith(prefix)
    ? targetFolder.slice(prefix.length)
    : targetFolder;
  const withoutTrailingSlash = withoutPrefix.endsWith('/')
    ? withoutPrefix.slice(0, -1)
    : withoutPrefix;
  return withoutTrailingSlash.split('/').map(safeDecodeURIComponent).join('/');
};

/**
 * The published copy's full resource path under `public/`:
 * `{resourceTypePrefix}/{getPublicTargetFolder(folderPath)}{resourceName}`.
 *
 * Publish and unpublish MUST both derive `targetUrl` through this function.
 * A publish whose `targetUrl` is wrong fails loudly, because Core has to
 * create the resource at that path; a `DELETE` resource whose `targetUrl`
 * matches no existing published copy is a request to remove nothing, which
 * Core can accept and an admin can approve while nothing observable changes.
 * One derivation for all four call sites (catalog publish/unpublish,
 * conversation publish/unpublish) is what keeps the two operations
 * addressing the same path.
 */
export const getPublishedTargetUrl = (
  resourceTypePrefix: string,
  folderPath: string,
  resourceName: string,
): string =>
  `${resourceTypePrefix}/${getPublicTargetFolder(folderPath)}${resourceName}`;

const FILE_RESOURCE_PREFIX = 'files/';

/*
 * An application's icon is a top-level `iconUrl` (or `icon_url`) field, not a
 * schema-declared file inside `application_properties`, so DIAL Core does not
 * relocate it on publish the way it relocates knowledge files — the published
 * copy kept pointing at the author's private bucket, where nobody else can
 * download it (#9446). Returns the icon as a DIAL file resource url when it
 * is an uploaded file in `appBucket`, or `undefined` for a theme icon name, an
 * absolute URL, a file already outside the author's bucket (e.g. `public`),
 * or a url carrying a `..` traversal segment. Query strings and `#`-fragments
 * are stripped.
 */
export const getPublishableIconUrl = (
  application: unknown,
  appBucket: string,
): string | undefined => {
  if (typeof application !== 'object' || application == null) return undefined;
  const { iconUrl, icon_url } = application as Record<string, unknown>;
  const rawIconUrl = iconUrl ?? icon_url;
  if (typeof rawIconUrl !== 'string') return undefined;

  const resourceUrl = rawIconUrl.split(/[?#]/, 1)[0];
  if (!resourceUrl.startsWith(FILE_RESOURCE_PREFIX)) return undefined;
  if (safeDecodeURIComponent(resourceUrl).split('/').includes('..'))
    return undefined;
  if (
    safeDecodeURIComponent(getResourceBucket(resourceUrl)) !==
    safeDecodeURIComponent(appBucket)
  )
    return undefined;

  return resourceUrl;
};

/**
 * The published icon's path: `files/public/{folderPath}/{targetResourceName}/{iconName}`.
 * Nesting it under the app's own versioned target name keeps two apps (or two
 * versions of one app) whose icons share a file name, e.g. `icon.png`, from
 * colliding in the same Organization folder.
 */
export const getPublishedIconTargetUrl = (
  folderPath: string,
  targetResourceName: string,
  iconUrl: string,
): string =>
  getPublishedTargetUrl(
    'files',
    folderPath,
    `${targetResourceName}/${getResourceName(iconUrl)}`,
  );

const CONVERSATION_RESOURCE_PREFIX = 'conversations/';

/**
 * The folder holding the attachment files of a published conversation:
 * `files/` plus the published conversation's own path, trailing-slashed, e.g.
 * `conversations/public/Org/my-chat` -> `files/public/Org/my-chat/`.
 *
 * The one derivation shared by publish (where the files are written), unpublish
 * (which lists the folder to delete its files) and the read-time resolution of
 * folder attachments, so the three can never disagree on where the files are.
 * @param publishedConversationUrl - `conversations/public/{folder}/{name}`, encoded
 */
export const getPublishedAttachmentsFolderUrl = (
  publishedConversationUrl: string,
): string =>
  `files/${publishedConversationUrl.slice(
    publishedConversationUrl.startsWith(CONVERSATION_RESOURCE_PREFIX)
      ? CONVERSATION_RESOURCE_PREFIX.length
      : 0,
  )}/`;

/**
 * The published path of one attachment file:
 * `files/public/{folderPath}/{conversationResourceName}/{source bucket}/{path in that bucket}`.
 * Nesting under the conversation's own target name keeps same-named files of
 * different conversations from colliding in one Organization folder, the same
 * way {@link getPublishedIconTargetUrl} does for an app icon; keeping the
 * source bucket as a segment ties every published file to the bucket it came
 * from, and keeping the bucket-relative path preserves folder structure.
 * @param folderPath - plain publish target folder
 * @param conversationResourceName - the conversation's resource name (last segment of its path)
 * @param sourceBucket - the bucket the file is published from
 * @param bucketRelativePath - the file's path inside `sourceBucket`, already percent-encoded
 */
export const getPublishedAttachmentTargetUrl = (
  folderPath: string,
  conversationResourceName: string,
  sourceBucket: string,
  bucketRelativePath: string,
): string =>
  `${getPublishedAttachmentsFolderUrl(
    getPublishedTargetUrl(
      'conversations',
      folderPath,
      conversationResourceName,
    ),
  )}${sourceBucket}/${bucketRelativePath}`;

/*
 * DIAL Core stores applications and toolsets as `{name}__{version}`, but
 * editing an existing one's version only rewrites the version field inside the
 * resource — its path keeps the version it was created with. Publishing a new
 * version must still land on a new `{name}__{version}` target, or Core rejects
 * it because the earlier version's copy already exists there (#9428).
 */
const VERSIONED_RESOURCE_PREFIXES = new Set(['applications', 'toolsets']);
const RESOURCE_VERSION_SEPARATOR = '__';
// The charset the application and toolset DTOs accept, never only dots.
const TARGET_VERSION_PATTERN = /^(?!\.+$)[\w.+-]{1,64}$/;

/**
 * The published copy's resource name for `version`: `resourceName`'s own
 * `{name}__{version}` suffix replaced by `version`. Returns `resourceName`
 * unchanged for an unversioned resource type, a name with no suffix, or a
 * `version` outside the DTO version charset (so free text never reaches the
 * path).
 */
export const getVersionedTargetResourceName = (
  resourceTypePrefix: string,
  resourceName: string,
  version: string | undefined,
): string => {
  const separatorIndex = resourceName.lastIndexOf(RESOURCE_VERSION_SEPARATOR);
  if (
    !VERSIONED_RESOURCE_PREFIXES.has(resourceTypePrefix) ||
    separatorIndex === -1 ||
    !version ||
    !TARGET_VERSION_PATTERN.test(version)
  ) {
    return resourceName;
  }
  return `${resourceName.slice(0, separatorIndex)}${RESOURCE_VERSION_SEPARATOR}${encodeURIComponent(version)}`;
};

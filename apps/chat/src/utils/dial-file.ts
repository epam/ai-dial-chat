import {
  isDialFileId,
  isDialFolderId,
  resolveDialFileBucketAndPath,
} from '@epam/ai-dial-chat-hooks';
import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { ApiEndpoints } from '../server-api/base';

/**
 * Converts a DIAL file ID (`files/{bucket}/{path}`) to the BFF download URL.
 * Returns `undefined` if the input does not start with `files/` or has no path segment.
 * The path segment is decoded with `decodeURIComponent` before being set as the query parameter.
 */
export const resolveDialFileDownloadUrl = (
  fileId: string,
): string | undefined => {
  const resolved = resolveDialFileBucketAndPath(fileId);
  if (!resolved) return undefined;
  const params = new URLSearchParams(resolved);
  return `/api/v1/files/download?${params.toString()}`;
};

/**
 * Converts a DIAL file ID (`files/{bucket}/{path}`) to the BFF metadata URL.
 * Returns `undefined` if the input does not start with `files/` or has no path segment.
 * The path segment is decoded with `decodeURIComponent` before being set as the query parameter.
 */
export const resolveDialFileMetadataUrl = (
  fileId: string,
): string | undefined => {
  const resolved = resolveDialFileBucketAndPath(fileId);
  if (!resolved) return undefined;
  const params = new URLSearchParams(resolved);
  return `/api/v1/files/metadata?${params.toString()}`;
};

/**
 * BFF bootstrap document that previews HTML with no file URL (inline
 * attachment `data`) under the sandboxed preview CSP instead of the app
 * shell's, so its inline styles and scripts run.
 */
export const DIAL_HTML_PREVIEW_FRAME_URL = '/api/v1/files/html-preview-frame';

/** Strips a trailing `#...` fragment (e.g. a PDF `#page=N` anchor) from a DIAL file id. */
const stripFragment = (fileId: string): string => fileId.split('#')[0];

/**
 * Rewrites a markdown `href`/`src` when it is a DIAL file id
 * (`files/{bucket}/{path}`); otherwise returns the URL unchanged. A trailing
 * `#page=N`-style anchor is stripped before resolving, the same as
 * {@link resolveDialUrl} does, so it is not percent-encoded into the `path`
 * query parameter (which would 404 the download).
 */
export const resolveMarkdownUrl = (url: string): string =>
  resolveDialFileDownloadUrl(stripFragment(url)) ?? url;

/* A folder id ends with `/`; DIAL Core has no download for a folder. */
const isDownloadableDialFileId = (url: string | undefined): url is string =>
  url != null && isDialFileId(url) && !isDialFolderId(url);

/**
 * Whether an attachment tile may offer a download. Only a DIAL folder
 * attachment is ruled out; reference-only and inline attachments keep the
 * download action their click handler already supports.
 */
export const isAttachmentDownloadable = (
  attachment: DisplayAttachment,
): boolean => attachment.url == null || !isDialFolderId(attachment.url);

const PROJECT_ID_PREFIX = 'projects/';
const PROJECT_CONTEXT_FILE_SEGMENT = '/files/context/';
const PROJECT_ARTIFACT_SEGMENT = '/files/artifacts/';

/* Each project file locator segment and the BFF route segment that serves it. */
const PROJECT_FILE_ROUTES = [
  { segment: PROJECT_CONTEXT_FILE_SEGMENT, route: 'files' },
  { segment: PROJECT_ARTIFACT_SEGMENT, route: 'artifacts' },
];

/**
 * Locator of a project's context file, `{projectId}/files/context/{fileName}`:
 * the `url` a project page gives the attachment it opens in the canvas, so the
 * canvas content resolvers fetch it like any other DIAL file.
 */
export const toProjectContextFileUrl = (
  projectId: string,
  fileName: string,
): string => `${projectId}${PROJECT_CONTEXT_FILE_SEGMENT}${fileName}`;

/**
 * Locator of a project's output, `{projectId}/files/artifacts/{fileName}`: a
 * file an agent saved under the project's `artifacts/` folder, opened in the
 * canvas like a context file.
 */
export const toProjectArtifactUrl = (
  projectId: string,
  fileName: string,
): string => `${projectId}${PROJECT_ARTIFACT_SEGMENT}${fileName}`;

/**
 * Converts a project file locator to the BFF endpoint that streams it:
 * `GET /api/v1/projects/:id/files/:fileName` for a context file and
 * `GET /api/v1/projects/:id/artifacts/:fileName` for an output. Returns
 * `undefined` when the input is not such a locator: no `projects/` prefix, no
 * project before the folder segment, or no single-segment file name after it.
 */
export const resolveProjectFileDownloadUrl = (
  url: string,
): string | undefined => {
  if (!url.startsWith(PROJECT_ID_PREFIX)) return undefined;
  /* The file name is one segment, so the last folder segment in the URL is the real one. */
  const match = PROJECT_FILE_ROUTES.map((entry) => ({
    ...entry,
    index: url.lastIndexOf(entry.segment),
  })).reduce((best, entry) => (entry.index > best.index ? entry : best));
  if (match.index <= PROJECT_ID_PREFIX.length) return undefined;
  const projectId = url.slice(0, match.index);
  const fileName = url.slice(match.index + match.segment.length);
  if (projectId.endsWith('/') || fileName === '' || fileName.includes('/')) {
    return undefined;
  }
  return `${ApiEndpoints.PROJECTS}/${encodeURIComponent(projectId)}/${match.route}/${encodeURIComponent(fileName)}`;
};

/**
 * Returns the best downloadable DIAL-file URL from an attachment's `url` or
 * `referenceUrl`, or `undefined` when neither is a valid DIAL `files/` path
 * to a file (a folder id is not downloadable). A project context file or
 * output locator in `url` resolves to the BFF endpoint that streams it.
 */
export const resolveDialUrl = (
  attachment: DisplayAttachment,
): string | undefined => {
  if (isDownloadableDialFileId(attachment.url)) {
    return resolveDialFileDownloadUrl(stripFragment(attachment.url));
  }
  if (isDownloadableDialFileId(attachment.referenceUrl)) {
    return resolveDialFileDownloadUrl(stripFragment(attachment.referenceUrl));
  }
  return attachment.url == null
    ? undefined
    : resolveProjectFileDownloadUrl(attachment.url);
};

/**
 * Returns an absolute downloadable URL for an attachment, or `undefined` when
 * it has none. Used for URLs handed to a cross-origin iframe: everything else
 * in the app fetches same-origin, where {@link resolveDialUrl}'s
 * host-relative path is correct, but a relative path posted into an iframe
 * would resolve against that iframe's own origin instead.
 */
export const resolveAbsoluteDialUrl = (
  attachment: DisplayAttachment,
): string | undefined => {
  const url = resolveDialUrl(attachment);
  if (url != null) {
    return new URL(url, window.location.origin).toString();
  }
  /* A non-DIAL `url` is already an absolute external URL — DIAL Core sends
   * those verbatim — so it needs no resolution, only validation. */
  if (attachment.url != null && isExternalHttpUrl(attachment.url)) {
    return attachment.url;
  }
  return undefined;
};

/** Returns whether `url` parses as an absolute `http(s)` URL. */
const isExternalHttpUrl = (url: string): boolean => {
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

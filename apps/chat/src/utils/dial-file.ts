import {
  isDialFileId,
  isDialFolderId,
  isDownloadableAttachment,
  parseDialProjectFileId,
  resolveDialFileBucketAndPath,
  type DialProjectFileIdParts,
} from '@epam/ai-dial-chat-hooks';
import type {
  DisplayAttachment,
  FileManagerDestinationPanelTexts,
} from '@epam/ai-dial-chat-shared';
import { DestinationFolderMode } from '@epam/ai-dial-react-file-manager';
import type { TFunction } from 'i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  CatalogI18nKeys,
  ConversationPublishI18nKeys,
  DialFileManagerI18nKeys,
  PublishI18nKeys,
} from '../constants/translation-keys';
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
 * (`files/{bucket}/{path}`) or a project file id; otherwise returns the URL
 * unchanged. A trailing
 * `#page=N`-style anchor is stripped before resolving, the same as
 * {@link resolveDialUrl} does, so it is not percent-encoded into the `path`
 * query parameter (which would 404 the download).
 */
export const resolveMarkdownUrl = (url: string): string =>
  resolveAttachmentDownloadUrl(url) ?? url;

/* A folder id ends with `/`; DIAL Core has no download for a folder. */
const isDownloadableDialFileId = (url: string | undefined): url is string =>
  url != null && isDialFileId(url) && !isDialFolderId(url);

/**
 * Whether an attachment tile may offer a download. A DIAL folder attachment,
 * and a project file id no BFF route serves, are ruled out; reference-only
 * and inline attachments keep the download action their click handler
 * already supports.
 */
export const isAttachmentDownloadable = (
  attachment: DisplayAttachment,
): boolean => {
  const { url } = attachment;
  if (url == null) return true;
  const projectFile = parseDialProjectFileId(url);
  if (projectFile != null) return toProjectFileRoute(projectFile) != null;
  return !isDialFolderId(url);
};

/**
 * Whether a stage attachment tile may offer a download: it must carry its own
 * content (a DIAL file or inline data) and pass {@link isAttachmentDownloadable}.
 * A reference-only search result is a link, not a file.
 */
export const isStageAttachmentDownloadable = (
  attachment: DisplayAttachment,
): boolean =>
  isDownloadableAttachment(attachment) && isAttachmentDownloadable(attachment);

const PROJECT_CONTEXT_FOLDER = 'context';
const PROJECT_ARTIFACTS_FOLDER = 'artifacts';

/* Percent-encodes every `/`-separated segment, the way DIAL Core writes a resource id. */
const encodePathSegments = (path: string): string =>
  path.split('/').map(encodeURIComponent).join('/');

/* The BFF route segment and the file path under it, or `undefined` for a folder no route serves. */
const toProjectFileRoute = ({
  filePath,
}: DialProjectFileIdParts): { route: string; filePath: string } | undefined => {
  const [folder, ...rest] = filePath;
  if (folder === PROJECT_CONTEXT_FOLDER && rest.length === 1) {
    return { route: 'files', filePath: rest[0] };
  }
  if (folder === PROJECT_ARTIFACTS_FOLDER && rest.length > 0) {
    return { route: 'artifacts', filePath: rest.join('/') };
  }
  return undefined;
};

/**
 * Locator of a project's context file, `{projectId}/files/context/{fileName}`
 * with every segment percent-encoded: the `url` a project page gives the
 * attachment it opens in the canvas, so the canvas content resolvers fetch it
 * like any other DIAL file. It has the shape of the id DIAL Core gives the
 * same file, so a `#` in a name cannot be read as a fragment.
 */
export const toProjectContextFileUrl = (
  projectId: string,
  fileName: string,
): string =>
  `${encodePathSegments(projectId)}/files/${PROJECT_CONTEXT_FOLDER}/${encodeURIComponent(fileName)}`;

/**
 * Locator of a project's output, `{projectId}/files/artifacts/{fileName}`
 * with every segment percent-encoded: a file an agent saved under the
 * project's `artifacts/` folder, opened in the canvas like a context file.
 * DIAL Core gives a generated attachment the same shape, possibly nested
 * (`artifacts/run-1/data.csv`).
 */
export const toProjectArtifactUrl = (
  projectId: string,
  fileName: string,
): string =>
  `${encodePathSegments(projectId)}/files/${PROJECT_ARTIFACTS_FOLDER}/${encodePathSegments(fileName)}`;

/**
 * Converts a project file id (`projects/{bucket}/{path}/files/{filePath}`,
 * percent-encoded as DIAL Core and {@link toProjectContextFileUrl} write it)
 * to the BFF endpoint that streams it: `GET /api/v1/projects/:id/files/:fileName`
 * for a context file and `GET /api/v1/projects/:id/artifacts/:fileName` for an
 * output, direct or nested. A `#...` fragment is ignored. Returns `undefined`
 * for anything else: not a project file id, a nested context file, or a
 * folder other than `context/` and `artifacts/`.
 */
export const resolveProjectFileDownloadUrl = (
  url: string,
): string | undefined => {
  const projectFile = parseDialProjectFileId(url);
  if (projectFile == null) return undefined;
  const target = toProjectFileRoute(projectFile);
  if (target == null) return undefined;
  return `${ApiEndpoints.PROJECTS}/${encodeURIComponent(projectFile.projectId)}/${target.route}/${encodeURIComponent(target.filePath)}`;
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
 * Resolves the id an attachment tile, the sources panel or audio playback
 * downloads: a DIAL file id (`files/{bucket}/{path}`) to the files download
 * route, and a project file id (`projects/{bucket}/{path}/files/{filePath}`)
 * to the project file route. A `#...` fragment is ignored. Returns
 * `undefined` for anything else.
 */
export const resolveAttachmentDownloadUrl = (
  fileId: string,
): string | undefined => {
  const id = stripFragment(fileId);
  if (isDialFileId(id)) return resolveDialFileDownloadUrl(id);
  return resolveProjectFileDownloadUrl(id);
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

/** Returns the translated search, folder-creation and retry text of the Copy/Move destination panel. */
export const getDestinationPanelTexts = (
  t: TFunction,
): FileManagerDestinationPanelTexts => ({
  cancelLabel: t(ButtonsI18nKeys.Cancel),
  closeAriaLabel: t(ButtonsI18nKeys.Close),
  searchPlaceholder: t(CatalogI18nKeys.PublishFolderSearchPlaceholder),
  clearSearchAriaLabel: t(BasicI18nKeys.ClearSearch),
  /* The package fills `{query}`; passing it through keeps i18next from leaving `{{query}}` behind. */
  folderEmptyStateLabel: t(CatalogI18nKeys.PublishFolderEmptyState, {
    query: '{query}',
  }),
  cancelCreatingFolderLabel: t(ButtonsI18nKeys.Cancel),
  addSiblingFolderLabel: t(PublishI18nKeys.AddSiblingFolder),
  addChildFolderLabel: t(PublishI18nKeys.AddChildFolder),
  createFolderEmptyNameError: t(
    ConversationPublishI18nKeys.EmptyFolderNameError,
  ),
  createFolderInvalidNameError: t(
    ConversationPublishI18nKeys.InvalidFolderNameError,
  ),
  createFolderDuplicateNameError: t(
    ConversationPublishI18nKeys.DuplicateFolderNameError,
  ),
  createFolderSameAsParentNameError: t(
    ConversationPublishI18nKeys.SameAsParentFolderNameError,
  ),
  createFolderHiddenNameWarning: t(
    DialFileManagerI18nKeys.RenameHiddenItemWarning,
  ),
  retryLabel: t(ButtonsI18nKeys.Retry),
  createFolderFailedMessage: t(DialFileManagerI18nKeys.FolderCreateError),
});

/** Returns the title of the Copy/Move destination panel: "Move file", "Move folder" or "Move N items". */
export const getDestinationPanelTitle = (
  t: TFunction,
  mode: DestinationFolderMode,
  count: number,
  isFolder: boolean,
): string => {
  const isMove = mode === DestinationFolderMode.Move;
  if (count > 1) {
    return t(
      isMove
        ? DialFileManagerI18nKeys.MoveItemsTitle
        : DialFileManagerI18nKeys.CopyItemsTitle,
      { count },
    );
  }
  if (isFolder) {
    return t(
      isMove
        ? DialFileManagerI18nKeys.MoveFolderTitle
        : DialFileManagerI18nKeys.CopyFolderTitle,
    );
  }
  return t(
    isMove
      ? DialFileManagerI18nKeys.MoveFileTitle
      : DialFileManagerI18nKeys.CopyFileTitle,
  );
};

/** Returns the Copy and Move destination-panel title callbacks the file manager shell takes. */
export const getDestinationPanelTitles = (
  t: TFunction,
): {
  getCopyDestinationTitle: (count: number, isFolder: boolean) => string;
  getMoveDestinationTitle: (count: number, isFolder: boolean) => string;
} => ({
  getCopyDestinationTitle: (count, isFolder) =>
    getDestinationPanelTitle(t, DestinationFolderMode.Copy, count, isFolder),
  getMoveDestinationTitle: (count, isFolder) =>
    getDestinationPanelTitle(t, DestinationFolderMode.Move, count, isFolder),
});

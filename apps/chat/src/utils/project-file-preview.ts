import {
  type DisplayAttachment,
  getAttachmentTypeFromMime,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import {
  isStoredContextFile,
  type ProjectContextFile,
} from '@epam/ai-dial-projects';
import { toProjectContextFileUrl } from './dial-file';

const PREVIEW_KEY_SEPARATOR = '::';

/** A project file card the page opens in the canvas: its card id, name and MIME type. */
interface ProjectFileCard {
  id: string;
  name: string;
  contentType: string;
}

/** Canvas key of a project file; the scope keeps one file name in two projects apart. */
export const toProjectPreviewKey = (scope: string, id: string): string =>
  `${scope}${PREVIEW_KEY_SEPARATOR}${id}`;

/** Card id behind a canvas key, or `undefined` when the key belongs to another scope or is not a project key. */
export const fromProjectPreviewKey = (
  scope: string,
  key: string | undefined,
): string | undefined => {
  const prefix = `${scope}${PREVIEW_KEY_SEPARATOR}`;
  return key?.startsWith(prefix) ? key.slice(prefix.length) : undefined;
};

/** The attachment for a file stored in a project: its `url` is the context file locator, which the canvas content resolvers fetch like any DIAL file. */
export const toStoredProjectFileAttachment = (
  { id, name, contentType }: ProjectFileCard,
  projectId: string,
): DisplayAttachment => ({
  id,
  name,
  contentType,
  type: getAttachmentTypeFromMime(contentType),
  status: RequestStatus.Idle,
  url: toProjectContextFileUrl(projectId, name),
});

/**
 * The attachment a project form opens in the canvas for one of its cards: a
 * file added in this session is its own attachment (it carries the `File`), a
 * stored one is built from its project. `undefined` for a stored file with no
 * project to read it from.
 */
export const toProjectContextFileAttachment = (
  file: ProjectContextFile,
  projectId: string | null,
): DisplayAttachment | undefined => {
  if (!isStoredContextFile(file)) return file;
  return projectId == null
    ? undefined
    : toStoredProjectFileAttachment(file, projectId);
};

import {
  type DisplayAttachment,
  getAttachmentTypeFromMime,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import {
  isStoredContextFile,
  type ProjectContextFile,
  type ProjectOutputItem,
} from '@epam/ai-dial-projects';
import { toProjectArtifactUrl, toProjectContextFileUrl } from './dial-file';

const PREVIEW_KEY_SEPARATOR = '::';
/* A context file name never contains `/`, so this prefix keeps an output's card id apart from a context file's. */
const OUTPUT_CARD_ID_PREFIX = 'artifacts/';

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

/** Card id of an output in a project preview key, `artifacts/{name}`. */
export const toProjectOutputCardId = (name: string): string =>
  `${OUTPUT_CARD_ID_PREFIX}${name}`;

/** Output name behind a card id, or `undefined` when the card is not an output. */
export const fromProjectOutputCardId = (
  cardId: string | undefined,
): string | undefined =>
  cardId?.startsWith(OUTPUT_CARD_ID_PREFIX)
    ? cardId.slice(OUTPUT_CARD_ID_PREFIX.length)
    : undefined;

/**
 * The attachment for a file stored in a project: its `url` is the file's
 * locator (a context file's by default), which the canvas content resolvers
 * fetch like any DIAL file.
 */
export const toStoredProjectFileAttachment = (
  { id, name, contentType }: ProjectFileCard,
  projectId: string,
  toLocator: (
    projectId: string,
    name: string,
  ) => string = toProjectContextFileUrl,
): DisplayAttachment => ({
  id,
  name,
  contentType,
  type: getAttachmentTypeFromMime(contentType),
  status: RequestStatus.Idle,
  url: toLocator(projectId, name),
});

/** The attachment the project view opens in the canvas for one of its outputs; its `url` is the output locator. */
export const toProjectOutputAttachment = (
  { name, contentType }: ProjectOutputItem,
  projectId: string,
): DisplayAttachment =>
  toStoredProjectFileAttachment(
    { id: name, name, contentType },
    projectId,
    toProjectArtifactUrl,
  );

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

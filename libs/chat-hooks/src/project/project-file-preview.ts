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

const PREVIEW_KEY_SEPARATOR = '::';
/* A context file name never contains `/`, so this prefix keeps an output's card id apart from a context file's. */
const OUTPUT_CARD_ID_PREFIX = 'artifacts/';

/** A project file card the page opens in the canvas: its card id, name and MIME type. */
export interface ProjectFileCard {
  /** Id of the card on the page; also the attachment id. */
  id: string;
  /** File name shown in the canvas header. */
  name: string;
  /** MIME type of the file. */
  contentType: string;
}

/** Builds the locator a canvas content resolver fetches for a project file, from the project id and the file name. The host owns the scheme. */
export type ProjectFileLocatorBuilder = (
  projectId: string,
  name: string,
) => string;

/** Returns the canvas key of a project file, `{scope}::{id}`; the scope keeps one file name in two projects apart. */
export const toProjectPreviewKey = (scope: string, id: string): string =>
  `${scope}${PREVIEW_KEY_SEPARATOR}${id}`;

/** Returns the card id behind a canvas key, or `undefined` when the key belongs to another scope or is not a project key. */
export const fromProjectPreviewKey = (
  scope: string,
  key: string | undefined,
): string | undefined => {
  const prefix = `${scope}${PREVIEW_KEY_SEPARATOR}`;
  return key?.startsWith(prefix) ? key.slice(prefix.length) : undefined;
};

/** Returns the card id of an output in a project preview key, `artifacts/{name}`. */
export const toProjectOutputCardId = (name: string): string =>
  `${OUTPUT_CARD_ID_PREFIX}${name}`;

/** Returns the output name behind a card id, or `undefined` when the card is not an output. */
export const fromProjectOutputCardId = (
  cardId: string | undefined,
): string | undefined =>
  cardId?.startsWith(OUTPUT_CARD_ID_PREFIX)
    ? cardId.slice(OUTPUT_CARD_ID_PREFIX.length)
    : undefined;

/** Returns the attachment for a file stored in a project; its `url` is the host-built locator the canvas content resolvers fetch like any DIAL file. */
export const toStoredProjectFileAttachment = (
  { id, name, contentType }: ProjectFileCard,
  projectId: string,
  toLocator: ProjectFileLocatorBuilder,
): DisplayAttachment => ({
  id,
  name,
  contentType,
  type: getAttachmentTypeFromMime(contentType),
  status: RequestStatus.Idle,
  url: toLocator(projectId, name),
});

/** Returns the attachment the project view opens in the canvas for one of its outputs; its `url` is the host-built output locator. */
export const toProjectOutputAttachment = (
  { name, contentType }: ProjectOutputItem,
  projectId: string,
  toLocator: ProjectFileLocatorBuilder,
): DisplayAttachment =>
  toStoredProjectFileAttachment(
    { id: name, name, contentType },
    projectId,
    toLocator,
  );

/** Returns the attachment a project form opens in the canvas for one of its cards: a file added in this session is its own attachment (it carries the `File`), a stored one is built from its project, and a stored file with no project yields `undefined`. */
export const toProjectContextFileAttachment = (
  file: ProjectContextFile,
  projectId: string | null,
  toLocator: ProjectFileLocatorBuilder,
): DisplayAttachment | undefined => {
  if (!isStoredContextFile(file)) return file;
  return projectId == null
    ? undefined
    : toStoredProjectFileAttachment(file, projectId, toLocator);
};

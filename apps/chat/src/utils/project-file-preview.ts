import {
  toProjectContextFileAttachment as toContextFileAttachment,
  toProjectOutputAttachment as toOutputAttachment,
  toStoredProjectFileAttachment as toStoredFileAttachment,
  type ProjectFileCard,
} from '@epam/ai-dial-chat-hooks/project';
import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import type {
  ProjectContextFile,
  ProjectOutputItem,
} from '@epam/ai-dial-projects';
import { toProjectArtifactUrl, toProjectContextFileUrl } from './dial-file';

/*
 * The preview keys, card ids and attachment builders are shared in
 * `@epam/ai-dial-chat-hooks/project`; the locator scheme and its mapping to the
 * BFF endpoints are the app's (`./dial-file`), so these bind the builders to it.
 */

/** Returns the attachment for a file stored in a project, with its context-file locator as `url`. */
export const toStoredProjectFileAttachment = (
  card: ProjectFileCard,
  projectId: string,
): DisplayAttachment =>
  toStoredFileAttachment(card, projectId, toProjectContextFileUrl);

/** Returns the attachment the project view opens in the canvas for one of its outputs, with its output locator as `url`. */
export const toProjectOutputAttachment = (
  item: ProjectOutputItem,
  projectId: string,
): DisplayAttachment =>
  toOutputAttachment(item, projectId, toProjectArtifactUrl);

/** Returns the attachment a project form opens in the canvas for one of its cards, or `undefined` for a stored file with no project. */
export const toProjectContextFileAttachment = (
  file: ProjectContextFile,
  projectId: string | null,
): DisplayAttachment | undefined =>
  toContextFileAttachment(file, projectId, toProjectContextFileUrl);

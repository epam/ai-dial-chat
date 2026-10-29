import { isSafeDialPathSegment } from '../../common/validators/dial-entity-name.validator';
import {
  parseProjectId,
  PROJECTS_ID_PREFIX,
  type ParsedProjectId,
} from './project-id.util';

/** Folder inside a project that holds its conversations; flat, no sub-folders. */
export const PROJECT_CONVERSATIONS_FOLDER = 'conversations';

/** The parts of a `projects/{bucket}/{projectPath}/conversations/{name}` locator. */
export interface ParsedProjectConversationLocator {
  /** The full locator, which is also the conversation's id. */
  locator: string;
  project: ParsedProjectId;
  /** Conversation file name, `{deploymentId}__{title}__{uuid}`. */
  name: string;
  /** Path of the conversation file inside the project, `conversations/{name}`. */
  filePath: string;
}

/**
 * Parses a decoded project conversation locator. Returns `null` unless the
 * second-to-last segment is `conversations`, everything before it is a valid
 * project id and the last segment is a safe path segment (`isSafeDialPathSegment`;
 * a deployment id may carry `:`) — so a nested
 * path under `conversations/`, an empty, `.` or `..` segment, a control
 * character or a backslash never reaches Core.
 */
export const parseProjectConversationLocator = (
  value: unknown,
): ParsedProjectConversationLocator | null => {
  if (typeof value !== 'string') return null;

  const segments = value.split('/');
  if (segments.length < 5) return null;

  const name = segments[segments.length - 1];
  if (
    segments[segments.length - 2] !== PROJECT_CONVERSATIONS_FOLDER ||
    !isSafeDialPathSegment(name)
  ) {
    return null;
  }

  const project = parseProjectId(segments.slice(0, -2).join('/'));
  if (!project) return null;

  return {
    locator: value,
    project,
    name,
    filePath: `${PROJECT_CONVERSATIONS_FOLDER}/${name}`,
  };
};

/** `true` when `value` is a valid project conversation locator. */
export const isProjectConversationLocator = (value: unknown): boolean =>
  parseProjectConversationLocator(value) != null;

/** Builds the locator of conversation `name` inside `project`. */
export const buildProjectConversationLocator = (
  project: ParsedProjectId,
  name: string,
): string => `${project.id}/${PROJECT_CONVERSATIONS_FOLDER}/${name}`;

/**
 * The completion-body `path` of a project conversation: the locator without
 * its leading `projects/`, which is what the app's stream hook derives from
 * the conversation id. It is also the generation-registry key.
 */
export const stripProjectConversationLocator = (locator: string): string =>
  locator.startsWith(`${PROJECTS_ID_PREFIX}/`)
    ? locator.slice(PROJECTS_ID_PREFIX.length + 1)
    : locator;

/** Re-prefixes a completion-body `path` and parses it; `null` when it is not a locator. */
export const fromStrippedProjectConversationPath = (
  path: unknown,
): ParsedProjectConversationLocator | null =>
  typeof path === 'string'
    ? parseProjectConversationLocator(`${PROJECTS_ID_PREFIX}/${path}`)
    : null;

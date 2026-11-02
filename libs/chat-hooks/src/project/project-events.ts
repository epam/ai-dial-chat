import {
  ProjectWatchAction,
  type ProjectWatchEventDto,
} from '@epam/ai-dial-chat-api-client';
import type { ProjectItem } from '@epam/ai-dial-projects';

/** The part of a projects watch event the list reacts to. */
export type ProjectWatchEvent = Pick<
  ProjectWatchEventDto,
  'id' | 'action' | 'timestamp'
>;

const WATCH_ACTIONS: ReadonlySet<string> = new Set(
  Object.values(ProjectWatchAction),
);

/** Returns the payload as a {@link ProjectWatchEvent}, or `undefined` when it is not one. */
export const parseProjectWatchEvent = (
  payload: unknown,
): ProjectWatchEvent | undefined => {
  if (payload == null || typeof payload !== 'object') return undefined;
  const { id, action, timestamp } = payload as Record<string, unknown>;
  if (
    typeof id !== 'string' ||
    typeof action !== 'string' ||
    !WATCH_ACTIONS.has(action) ||
    typeof timestamp !== 'number'
  ) {
    return undefined;
  }
  return { id, action: action as ProjectWatchAction, timestamp };
};

/**
 * Returns the projects after one watch event: a create or update moves the
 * project's `updatedAt` forward (never back), a delete removes it, and an
 * event for an unlisted project is ignored. Returns `items` itself when
 * nothing changed.
 */
export const applyProjectEvent = (
  items: ProjectItem[],
  event: ProjectWatchEvent,
): ProjectItem[] => {
  const index = items.findIndex((item) => item.id === event.id);
  if (index < 0) return items;

  if (event.action === ProjectWatchAction.Delete) {
    return items.filter((_, itemIndex) => itemIndex !== index);
  }

  const item = items[index];
  if ((item.updatedAt ?? 0) >= event.timestamp) return items;
  const next = [...items];
  next[index] = { ...item, updatedAt: event.timestamp };
  return next;
};

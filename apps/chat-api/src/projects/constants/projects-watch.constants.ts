/*
 * Bounds the project ids one watch request may subscribe to: one listing
 * page of a source (`PROJECTS_PAGE_SIZE`). DIAL Core sets no limit of its
 * own, so this keeps the request body and the Core subscription bounded.
 */
export const PROJECTS_WATCH_MAX_IDS = 1000;

/** Bounds one decoded DIAL Core event frame, in characters; a project event is a few hundred. */
export const PROJECTS_WATCH_MAX_FRAME_LENGTH = 64 * 1024;

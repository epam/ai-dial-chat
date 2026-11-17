/**
 * The roots of the Save panel's destination tree. Kept in its own module, free
 * of any `@epam/ai-dial-publish-panel` import, so the lean `./utils` entry can
 * reach it without that optional peer.
 */
export enum SaveDestinationRoot {
  /** The user's own folders for the resource type. */
  Personal = 'personal',
  /** The Organization/public bucket; saving here also sends a publish request. */
  Organization = 'organization',
}

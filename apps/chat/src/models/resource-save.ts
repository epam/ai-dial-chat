import type { CatalogPublishEntityType } from '@epam/ai-dial-chat-hooks';
import type {
  FolderDestination,
  PublicationRule,
  SaveVersionMode,
} from '@epam/ai-dial-publish-panel';
import type { ResourceSaveOutcome } from '../types/resource-save';

/** What a save step produced: the full id of the resource it wrote. */
export interface SavedResource {
  /** Full DIAL Core id `{type}/{bucket}/{path}`. */
  id: string;
}

/**
 * The resource-specific operations the Save panel runs, supplied by each
 * editor. Everything the orchestrator needs to know about a resource type
 * goes through here.
 */
export interface ResourceSaveAdapter {
  /** The publish API entity type of the resource. */
  publishEntityType: CatalogPublishEntityType;
  /** Whether the resource has versions; an unversioned one never forks. */
  isVersioned: boolean;
  /** Saves the editor's current state in place; the editor's existing Save. */
  saveInPlace: () => Promise<SavedResource>;
  /** Writes the edits as `{folderPath}/{name}__{version}`, leaving the stored current version unchanged. Required when `isVersioned`. */
  saveAsNewVersion?: (
    version: string,
    folderPath: string[],
  ) => Promise<SavedResource>;
  /** Moves a saved resource into `folderPath` of the user's own bucket. */
  move: (id: string, folderPath: string[]) => Promise<SavedResource>;
}

/** What the user chose in the Save panel. */
export interface ResourceSaveChoice {
  /** Full id of the resource being edited. */
  resourceId: string;
  /** Its current Personal folder. */
  currentFolderPath: string[];
  /** Its current version; `undefined` for an unversioned resource. */
  currentVersion?: string;
  /** The confirmed destination. */
  destination: FolderDestination;
  /** Keep the version or save a new one. Ignored for an unversioned resource. */
  versionMode: SaveVersionMode;
  /** The new version, used when `versionMode` is `New`. */
  newVersion: string;
  /** Access rules sent with the publish request for an Organization destination. */
  rules?: PublicationRule[];
}

/** Sends the publish request for a saved resource. */
export type PublishSavedResource = (
  entityType: CatalogPublishEntityType,
  id: string,
  folderPath: string[],
  version: string | undefined,
  rules: PublicationRule[],
) => Promise<void>;

/** The result of a save whose first step succeeded. */
export interface ResourceSaveResult {
  /** How the later steps ended. */
  outcome: ResourceSaveOutcome;
  /** Id of the saved resource (the new version's, after a fork). */
  savedId: string;
  /** Whether a new version was written. */
  isNewVersion: boolean;
  /** Whether a publish request was sent successfully. */
  isPublished: boolean;
  /** The error of the step that failed after the save, if any. */
  error?: unknown;
}

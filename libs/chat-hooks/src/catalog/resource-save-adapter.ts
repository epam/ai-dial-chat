import type { CatalogPublishEntityType } from './publish';

/** What a save step produced: the full id of the resource it wrote. */
export interface SavedResource {
  /** Full DIAL Core id `{type}/{bucket}/{path}`. */
  id: string;
}

/** The operations the Save panel runs for a resource that already exists, supplied by each editor. */
export interface ResourceEditSaveAdapter {
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

/** The operation the Save panel runs for a resource being created, supplied by each editor. */
export interface ResourceCreateSaveAdapter {
  /** The publish API entity type of the resource. */
  publishEntityType: CatalogPublishEntityType;
  /** Always `false`: a new resource takes its version from the form, so the panel offers no version choice. */
  isVersioned: false;
  /** Creates the resource in `folderPath` of the user's own bucket, never overwriting an existing one. */
  createIn: (folderPath: string[]) => Promise<SavedResource>;
}

/** The resource-specific operations the Save panel runs. */
export type ResourceSaveAdapter =
  ResourceEditSaveAdapter | ResourceCreateSaveAdapter;

/** Returns whether `adapter` creates a new resource rather than saving an existing one. */
export const isResourceCreateAdapter = (
  adapter: ResourceSaveAdapter,
): adapter is ResourceCreateSaveAdapter => 'createIn' in adapter;

/** A save failure whose `message` is already translated for the user, e.g. a half-finished version commit. */
export class ResourceSaveError extends Error {}

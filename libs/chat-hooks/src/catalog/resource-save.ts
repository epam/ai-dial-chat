import {
  SaveVersionMode,
  toFolderPathKey,
  type FolderDestination,
  type PublicationRule,
} from '@epam/ai-dial-publish-panel';
import {
  toPublishRuleDto,
  type PublishApiClient,
} from './create-publish-api';
import type { CatalogPublishEntityType } from './publish';

/** The roots of the Save panel's destination tree. */
export enum SaveDestinationRoot {
  /** The user's own folders for the resource type. */
  Personal = 'personal',
  /** The Organization/public bucket; saving here also sends a publish request. */
  Organization = 'organization',
}

/** How a save that reached at least its first step ended. */
export enum ResourceSaveOutcome {
  /** Every step succeeded. */
  Saved = 'saved',
  /** The save succeeded but moving into the chosen Personal folder failed. */
  SavedButMoveFailed = 'savedButMoveFailed',
  /** The save succeeded but the publish request failed. */
  SavedButPublishFailed = 'savedButPublishFailed',
}

/** Why the new version typed in the Save panel cannot be used. */
export enum ResourceSaveVersionError {
  /** It does not match the host's version pattern. */
  Invalid = 'invalid',
  /** It equals the resource's current version. */
  Unchanged = 'unchanged',
  /** DIAL Core already stores a resource with that version. */
  Exists = 'exists',
}

/** What a save step produced: the full id of the resource it wrote. */
export interface SavedResource {
  /** Full DIAL Core id `{type}/{bucket}/{path}`. */
  id: string;
}

/** The resource-specific operations the Save panel runs, supplied by each editor. */
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

/** A save failure whose `message` is already translated for the user, e.g. a half-finished version commit. */
export class ResourceSaveError extends Error {}

const isSameFolder = (a: string[], b: string[]): boolean =>
  toFolderPathKey(a) === toFolderPathKey(b);

/** Returns a {@link PublishSavedResource} that sends the catalog publish request through `client`. */
export const createPublishSavedResource =
  (
    client: Pick<PublishApiClient, 'publishCatalogEntity'>,
  ): PublishSavedResource =>
  async (entityType, id, folderPath, version, rules) => {
    await client.publishCatalogEntity(entityType, id, {
      folderPath: folderPath.join('/'),
      ...(version ? { version } : {}),
      rules: rules.map(toPublishRuleDto),
    });
  };

/**
 * Runs the Save panel's choice through `adapter`: save in place or as a new
 * version, then move into a different Personal folder, or publish to an
 * Organization folder. Rejects only when the first step fails; a failure
 * after the save resolves with the matching partial outcome, because the
 * save itself already happened.
 */
export const runResourceSave = async (
  adapter: ResourceSaveAdapter,
  choice: ResourceSaveChoice,
  publish: PublishSavedResource,
): Promise<ResourceSaveResult> => {
  const isNewVersion =
    adapter.isVersioned && choice.versionMode === SaveVersionMode.New;
  const isOrganization =
    choice.destination.rootKey === SaveDestinationRoot.Organization;
  /* Publishing keeps the resource where it lives; only a Personal destination relocates it. */
  const personalFolder = isOrganization
    ? choice.currentFolderPath
    : choice.destination.path;

  let savedId: string;
  if (isNewVersion) {
    if (!adapter.saveAsNewVersion) {
      throw new Error('This resource cannot be saved as a new version');
    }
    ({ id: savedId } = await adapter.saveAsNewVersion(
      choice.newVersion,
      personalFolder,
    ));
  } else {
    ({ id: savedId } = await adapter.saveInPlace());
  }

  const result: ResourceSaveResult = {
    outcome: ResourceSaveOutcome.Saved,
    savedId,
    isNewVersion,
    isPublished: false,
  };

  if (
    !isNewVersion &&
    !isOrganization &&
    !isSameFolder(personalFolder, choice.currentFolderPath)
  ) {
    try {
      ({ id: result.savedId } = await adapter.move(savedId, personalFolder));
    } catch (error) {
      return {
        ...result,
        outcome: ResourceSaveOutcome.SavedButMoveFailed,
        error,
      };
    }
  }

  if (isOrganization) {
    try {
      await publish(
        adapter.publishEntityType,
        result.savedId,
        choice.destination.path,
        isNewVersion ? choice.newVersion : choice.currentVersion,
        choice.rules ?? [],
      );
      result.isPublished = true;
    } catch (error) {
      return {
        ...result,
        outcome: ResourceSaveOutcome.SavedButPublishFailed,
        error,
      };
    }
  }

  return result;
};

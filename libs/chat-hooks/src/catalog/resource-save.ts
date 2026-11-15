import {
  SaveVersionMode,
  toFolderPathKey,
  type FolderDestination,
  type PublicationRule,
} from '@epam/ai-dial-publish-panel';
import { toPublishRuleDto, type PublishApiClient } from './create-publish-api';
import type { CatalogPublishEntityType } from './publish';
import {
  isResourceCreateAdapter,
  type ResourceSaveAdapter,
} from './resource-save-adapter';

export * from './resource-save-adapter';

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
  /** Whether the resource was created rather than saved. */
  isCreated: boolean;
  /** Whether a new version was written. */
  isNewVersion: boolean;
  /** Whether a publish request was sent successfully. */
  isPublished: boolean;
  /** The error of the step that failed after the save, if any. */
  error?: unknown;
}

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
 * Runs the Save panel's choice through `adapter`: create the resource in the
 * chosen Personal folder, or save it in place or as a new version and then
 * move it into a different Personal folder; for an Organization folder, save
 * where it lives and publish. Rejects only when the first step fails; a failure
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
  let shouldMove = false;
  if (isResourceCreateAdapter(adapter)) {
    ({ id: savedId } = await adapter.createIn(personalFolder));
  } else if (isNewVersion) {
    if (!adapter.saveAsNewVersion) {
      throw new Error('This resource cannot be saved as a new version');
    }
    ({ id: savedId } = await adapter.saveAsNewVersion(
      choice.newVersion,
      personalFolder,
    ));
  } else {
    ({ id: savedId } = await adapter.saveInPlace());
    shouldMove =
      !isOrganization &&
      !isSameFolder(personalFolder, choice.currentFolderPath);
  }

  const result: ResourceSaveResult = {
    outcome: ResourceSaveOutcome.Saved,
    savedId,
    isCreated: isResourceCreateAdapter(adapter),
    isNewVersion,
    isPublished: false,
  };

  if (shouldMove && !isResourceCreateAdapter(adapter)) {
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

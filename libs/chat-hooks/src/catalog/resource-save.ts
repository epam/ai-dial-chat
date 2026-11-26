import { OrgUnitCopyErrorCode } from '@epam/ai-dial-chat-api-client';
import {
  SaveVersionMode,
  toFolderPathKey,
  type FolderDestination,
} from '@epam/ai-dial-publish-panel';
import { getApiErrorDetails, getApiErrorStatus } from '../api-error/api-error';
import type { PublishApiClient } from './create-publish-api';
import type { CatalogPublishEntityType } from './publish';
import {
  isResourceCreateAdapter,
  type ResourceSaveAdapter,
} from './resource-save-adapter';
import { SaveDestinationRoot } from './save-destination-root';

export * from './resource-save-adapter';

export { SaveDestinationRoot };

/**
 * Returns the Save panel root a destination's `rootKey` names, or `undefined`
 * for a key that is not one of its roots.
 * @param rootKey - the `rootKey` of a `FolderDestination`
 */
export const toSaveDestinationRoot = (
  rootKey: string,
): SaveDestinationRoot | undefined =>
  Object.values(SaveDestinationRoot).find((root) => root === rootKey);

/** How a save that reached at least its first step ended. */
export enum ResourceSaveOutcome {
  /** Every step succeeded. */
  Saved = 'saved',
  /** The save succeeded but moving into the chosen Personal folder failed. */
  SavedButMoveFailed = 'savedButMoveFailed',
  /** The save succeeded but the publish request failed. */
  SavedButPublishFailed = 'savedButPublishFailed',
  /** The save succeeded but the direct write into the org-unit folder failed. */
  SavedButOrgUnitWriteFailed = 'savedButOrgUnitWriteFailed',
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
  /** Whether the Organization destination takes a direct write (an org unit the user may write to) instead of a publish request. Defaults to `false`. */
  isDirectWrite?: boolean;
}

/** Sends the publish request for a saved resource. */
export type PublishSavedResource = (
  entityType: CatalogPublishEntityType,
  id: string,
  folderPath: string[],
  version: string | undefined,
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
  /** Whether the resource was written directly into an org-unit folder; `false` or absent when it was not. */
  isWrittenToOrgUnit?: boolean;
  /** The error of the step that failed after the save, if any. */
  error?: unknown;
}

/**
 * Whether a failed direct write is the server's refusal of an application that
 * refers to a folder of files (`422`, code `folderReferenceNeedsRequest`),
 * which a publication request carries instead.
 * @param error - the rejection of the adapter's direct write
 */
const isFolderReferenceRefusal = async (error: unknown): Promise<boolean> => {
  if (getApiErrorStatus(error) !== 422) return false;
  const { code } = await getApiErrorDetails(error);
  return code === OrgUnitCopyErrorCode.FolderReferenceNeedsRequest;
};

const isSameFolder = (a: string[], b: string[]): boolean =>
  toFolderPathKey(a) === toFolderPathKey(b);

/** Returns a {@link PublishSavedResource} that sends the catalog publish request through `client`. */
export const createPublishSavedResource =
  (
    client: Pick<PublishApiClient, 'publishCatalogEntity'>,
  ): PublishSavedResource =>
  async (entityType, id, folderPath, version) => {
    await client.publishCatalogEntity(entityType, id, {
      folderPath: folderPath.join('/'),
      ...(version ? { version } : {}),
    });
  };

/**
 * Runs the Save panel's choice through `adapter`: create the resource in the
 * chosen Personal folder, or save it in place or as a new version and then
 * move it into a different Personal folder; for an Organization folder, save
 * where it lives and publish, or write it into the org-unit folder directly
 * when the choice says so and the adapter can. Rejects only when the first step fails; a failure
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
  /* A direct write needs the adapter's own operation; without it the destination keeps the publish rows. */
  const isDirectWrite =
    isOrganization &&
    choice.isDirectWrite === true &&
    adapter.saveIntoOrgUnit != null;
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
    isWrittenToOrgUnit: false,
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

  let isRequestedInstead = false;
  if (isOrganization && isDirectWrite) {
    try {
      await adapter.saveIntoOrgUnit?.(result.savedId, choice.destination.path);
      result.isWrittenToOrgUnit = true;
    } catch (error) {
      if (!(await isFolderReferenceRefusal(error))) {
        return {
          ...result,
          outcome: ResourceSaveOutcome.SavedButOrgUnitWriteFailed,
          error,
        };
      }
      isRequestedInstead = true;
    }
  }
  if (isOrganization && (!isDirectWrite || isRequestedInstead)) {
    try {
      await publish(
        adapter.publishEntityType,
        result.savedId,
        choice.destination.path,
        isNewVersion ? choice.newVersion : choice.currentVersion,
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

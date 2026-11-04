import { toFolderPathKey, SaveVersionMode } from '@epam/ai-dial-publish-panel';
import type {
  PublishSavedResource,
  ResourceSaveAdapter,
  ResourceSaveChoice,
  ResourceSaveResult,
} from '../models/resource-save';
import {
  ResourceSaveOutcome,
  SaveDestinationRoot,
} from '../types/resource-save';

/** A save failure whose `message` is already translated for the user, e.g. a half-finished version commit. */
export class ResourceSaveError extends Error {}

const isSameFolder = (a: string[], b: string[]): boolean =>
  toFolderPathKey(a) === toFolderPathKey(b);

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

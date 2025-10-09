import { Observable, forkJoin, of, switchMap } from 'rxjs';

import { splitEntityId } from '@/src/utils/app/shared-utils';
import {
  getIdWithoutVersionFromApiKey,
  getPublicItemIdWithoutVersion,
  getVersionFromId,
  parseEntityApiKey,
  pathKeySeparator,
} from '@/src/utils/server/api';

import { ApiKeys, FeatureType } from '@/src/types/common';
import { PromptInfo } from '@/src/types/prompt';
import {
  PublicVersionGroups,
  Publication,
  PublicationRequestModel,
  PublicationResource,
  PublicationRule,
  PublicationUpdateRequestModel,
  ResourceToReview,
  TargetAudienceFilter,
} from '@/src/types/publication';

import {
  EDITED_FOLDER_NAME_KEY,
  FolderEditTree,
  FolderNode,
} from '@/src/store/publication/publication.types';

import {
  DEFAULT_VERSION,
  NA_VERSION,
  PUBLIC_URL_PREFIX,
} from '@/src/constants/publication';

import {
  isEntityNameValid,
  prepareEntityName,
  sortItemsVersions,
} from './common';
import { BucketService } from './data/bucket-service';
import { FileService } from './data/file-service';
import { constructPath } from './file';
import { getFolderIdFromEntityId } from './folders';
import {
  getEntityBucket,
  getRootId,
  isApplicationId,
  isConversationId,
  isFileId,
  isRootId,
  isToolsetId,
} from './id';

import { ConversationInfo, PublishActions } from '@epam/ai-dial-shared';

export const isEntityIdPublic = (
  entity: { id: string },
  featureType?: FeatureType,
) => {
  if (!featureType) {
    return getEntityBucket(entity) === PUBLIC_URL_PREFIX;
  }

  return entity.id.startsWith(
    getRootId({ featureType, bucket: PUBLIC_URL_PREFIX }),
  );
};

export const createFoldersFilesTargetUrl = (id: string) => {
  const baseElements = id.split('/').slice(2, -1);
  const lastElement = id.split('/').slice(-1);

  return constructPath(
    ApiKeys.Files,
    PUBLIC_URL_PREFIX,
    ...baseElements,
    ...lastElement,
  );
};

export const findLatestVersion = (versions: string[]) => {
  const filteredVersions = versions.filter((v) => v !== NA_VERSION);

  if (!filteredVersions.length) {
    return NA_VERSION;
  }

  const sortedVersions = filteredVersions.sort((a, b) => {
    const versionPartsA = a.split('.').map(Number);
    const versionPartsB = b.split('.').map(Number);

    for (
      let i = 0;
      i < Math.max(versionPartsA.length, versionPartsB.length);
      i++
    ) {
      const diff = (versionPartsB[i] || 0) - (versionPartsA[i] || 0);
      if (diff !== 0) return diff;
    }

    return 0;
  });

  return sortedVersions[0];
};

export const mapPublishedItems = <T extends PromptInfo | ConversationInfo>(
  items: { id: string; updatedAt?: number }[],
  featureType: FeatureType,
) =>
  items.reduce<{
    publicVersionGroups: PublicVersionGroups;
    items: T[];
  }>(
    (acc, item) => {
      const parsedApiKey = parseEntityApiKey(splitEntityId(item.id).name, {
        parseVersion: true,
        parseModel: featureType === FeatureType.Chat,
      });

      if (parsedApiKey.version) {
        const idWithoutVersion = getPublicItemIdWithoutVersion(
          parsedApiKey.version,
          item.id,
        );
        const currentVersionGroup = acc.publicVersionGroups[idWithoutVersion];

        const newVersion = {
          version: parsedApiKey.version,
          id: item.id,
        };

        if (!currentVersionGroup) {
          acc.publicVersionGroups[idWithoutVersion] = {
            selectedVersion: newVersion,
            allVersions: [newVersion],
          };
        } else {
          const allVersions =
            currentVersionGroup.allVersions.concat(newVersion);

          const latestVersion = findLatestVersion(
            allVersions.map(({ version }) => version),
          );

          acc.publicVersionGroups[idWithoutVersion] = {
            selectedVersion:
              latestVersion === currentVersionGroup.selectedVersion.version
                ? currentVersionGroup.selectedVersion
                : newVersion,
            allVersions,
          };
        }
      }

      const folderId = getFolderIdFromEntityId(item.id);
      const itemToAdd = {
        name: parsedApiKey.name,
        publicationInfo: {
          version: parsedApiKey.version,
        },
        id: item.id,
        folderId,
        publishedWithMe: isRootId(folderId),
      } as T;

      if (featureType === FeatureType.Chat) {
        itemToAdd.updatedAt = item.updatedAt;

        if (parsedApiKey.modelInfo) {
          (itemToAdd as ConversationInfo).model = parsedApiKey.modelInfo.model;
          (itemToAdd as ConversationInfo).isPlayback =
            parsedApiKey.modelInfo.isPlayback;
          (itemToAdd as ConversationInfo).isReplay =
            parsedApiKey.modelInfo.isReplay;
        }
      }

      acc.items.push(itemToAdd);

      return acc;
    },
    {
      publicVersionGroups: {},
      items: [],
    },
  );

export const getPublicationId = (url: string) =>
  url.split('/').slice(-1).shift();

export const getItemsIdsToRemoveAndHide = (
  allResources: PublicationResource[],
  resourcesToReview: ResourceToReview[],
) => {
  const itemsToHide: PublicationResource[] = [];
  const itemsToRemove: PublicationResource[] = [];

  const reviewUrlCountMap = resourcesToReview.reduce<Record<string, number>>(
    (acc, res) => {
      acc[res.reviewUrl] = (acc[res.reviewUrl] || 0) + 1;
      return acc;
    },
    {},
  );

  allResources.forEach((resource) => {
    const count = reviewUrlCountMap[resource.reviewUrl] || 0;

    if (count > 1) {
      itemsToHide.push(resource);
    } else {
      itemsToRemove.push(resource);
    }
  });

  return {
    itemsToHideIds: itemsToHide.map((item) => item.reviewUrl),
    itemsToRemoveIds: itemsToRemove.map((item) => item.reviewUrl),
  };
};

export const getVersionGroupFromId = (id: string) => {
  return {
    versionGroupId: getIdWithoutVersionFromApiKey(id),
    currentVersion: getVersionFromId(id),
  };
};

/**
 * Process publication resources and handle file validation
 */
export const processPublicationResources = <
  T extends PublicationRequestModel | PublicationUpdateRequestModel,
>(
  payload: T,
): Observable<{
  publicationData: T;
  isPublishingExternalFiles: boolean;
}> => {
  return forkJoin({
    payload: of(payload),
    publicFiles: payload.resources.find((r) => isFileId(r.sourceUrl))
      ? FileService.getMultipleFoldersFiles(
          payload.resources
            .filter((r) => isFileId(r.sourceUrl))
            .map((r) => getFolderIdFromEntityId(r.targetUrl)),
        )
      : of([]),
  }).pipe(
    switchMap(({ payload, publicFiles }) => {
      const fileIds = payload.resources
        .map(({ sourceUrl }) => sourceUrl)
        .filter((id) => id && isFileId(id));

      const publicFileIds = publicFiles.map((file) => file.id);
      const userBucket = BucketService.getBucket();

      const isPublishingExternalFiles = fileIds.some((id) => {
        const { bucket: fileBucket } = splitEntityId(id as string);
        return fileBucket !== userBucket;
      });

      const resources = payload.resources.map((resource) => {
        if (
          publicFileIds.includes(resource.targetUrl) &&
          resource.action === PublishActions.ADD
        ) {
          return {
            ...resource,
            action: PublishActions.ADD_IF_ABSENT,
          };
        }
        return resource;
      });

      const publicationData: T = {
        ...payload,
        resources,
      };
      return of({ publicationData, isPublishingExternalFiles });
    }),
  );
};

export const getFirstReviewUrl = (
  resourcesToReview: ResourceToReview[],
  reviewedResources: ResourceToReview[],
) => {
  return resourcesToReview.length
    ? resourcesToReview[0].reviewUrl
    : reviewedResources[0].reviewUrl;
};

export const getReviewItems = (
  publication: Publication,
  resourcesToReview: ResourceToReview[],
  isItemId: (id: string) => boolean,
) => {
  const toReview = resourcesToReview.filter(
    (r) =>
      !r.reviewed &&
      r.publicationUrl === publication.url &&
      isItemId(r.reviewUrl),
  );
  const reviewed = resourcesToReview.filter(
    (r) => r.publicationUrl === publication.url && isItemId(r.reviewUrl),
  );

  return { toReview, reviewed };
};

export const getDefaultAllEditEntities = (
  resources: PublicationResource[],
  versionGroups: PublicVersionGroups,
  { isReview }: { isReview: boolean },
): {
  entities: Record<string, { name: string; version: string }>;
  folders: FolderEditTree;
} => {
  const allEditEntitiesMap: Record<
    string,
    {
      name: string;
      version: string;
    }
  > = {};

  if (isReview) {
    resources.forEach((item) => {
      const apiKey = splitEntityId(item.reviewUrl).name;

      const { name, version } = parseEntityApiKey(apiKey, {
        parseVersion: true,
        parseModel: isConversationId(item.reviewUrl),
      });

      allEditEntitiesMap[item.reviewUrl] = { name, version };
    });
  } else {
    resources.forEach(({ reviewUrl, action }) => {
      const apiKey = splitEntityId(reviewUrl).name;
      const { name } = parseEntityApiKey(apiKey, {
        parseModel: isConversationId(reviewUrl),
        parseVersion:
          isApplicationId(reviewUrl) ||
          isToolsetId(reviewUrl) ||
          action === PublishActions.DELETE,
      });

      const entityIdPart = reviewUrl.split('/');
      entityIdPart[1] = PUBLIC_URL_PREFIX;
      const publicEntityId = entityIdPart.join('/');
      const versionGroup = versionGroups[publicEntityId];

      const latestVersion = sortItemsVersions(
        versionGroup?.allVersions ?? [],
      ).at(0)?.version;

      if (!latestVersion) {
        allEditEntitiesMap[reviewUrl] = {
          name,
          version: DEFAULT_VERSION,
        };
      } else {
        const nextVersion = latestVersion.split('.');
        nextVersion[2] = String(+nextVersion[2] + 1);
        allEditEntitiesMap[reviewUrl] = {
          name,
          version: nextVersion.join('.'),
        };
      }
    });
  }

  const allFoldersStructure: FolderEditTree = {};
  resources.forEach(({ reviewUrl }) => {
    const folderSegments = getFolderIdFromEntityId(reviewUrl).split('/');
    let currentLevel = allFoldersStructure;

    folderSegments.forEach((segment) => {
      if (!currentLevel[segment]) {
        currentLevel[segment] = { [EDITED_FOLDER_NAME_KEY]: segment };
      }

      currentLevel = currentLevel[segment] as FolderEditTree;
    });
  });

  return {
    entities: allEditEntitiesMap,
    folders: allFoldersStructure,
  };
};

export const mapRuleToFilter = (
  rule: PublicationRule,
): TargetAudienceFilter => ({
  filterFunction: rule.function,
  filterParams: rule.targets,
  id: rule.source,
});

export const mapFilterToRule = (
  filter: TargetAudienceFilter,
): PublicationRule => ({
  function: filter.filterFunction,
  source: filter.id,
  targets: filter.filterParams,
});

export const regenerateApiKeyNameAndVersionParts = (
  entityId: string,
  name: string,
  version: string,
): string => {
  const preparedName = prepareEntityName(name);

  if (isConversationId(entityId)) {
    const modelName = splitEntityId(entityId).name;
    const parsedModelReference = parseEntityApiKey(modelName, {
      parseModel: true,
    }).modelInfo.model.id;
    return [parsedModelReference, preparedName, version].join(pathKeySeparator);
  }

  if (isFileId(entityId)) {
    return preparedName;
  }

  return [preparedName, version].join(pathKeySeparator);
};

export const getPublicationDefaultName = (userName?: string) =>
  `New request by ${userName ?? 'Unknown Author'}`;

export const allEditedFoldersAreValid = (obj: unknown) => {
  for (const key in obj as Record<string, string>) {
    const value = (obj as Record<string, string>)[key];

    if (typeof value === 'object' && value !== null) {
      // Check for the duplicated names
      const seenNames = new Set<string>();
      for (const sibling of Object.values(value as FolderNode)) {
        if (
          typeof sibling === 'object' &&
          sibling !== null &&
          sibling[EDITED_FOLDER_NAME_KEY]
        ) {
          const name = sibling[EDITED_FOLDER_NAME_KEY].trim();

          if (seenNames.has(name)) return false;
          seenNames.add(name);
        }
      }

      if (EDITED_FOLDER_NAME_KEY in value) {
        if (!value[EDITED_FOLDER_NAME_KEY]) {
          return false;
        }
        const folderName = (value[EDITED_FOLDER_NAME_KEY] as string).trim();

        if (!isEntityNameValid(folderName)) {
          return false;
        }
      }

      if (!allEditedFoldersAreValid(value)) {
        return false;
      }
    }
  }

  return true;
};

/**
 * Checks if a given folder name conflicts with any edited names of sibling folders.
 *
 * @param name - The proposed name to check for conflicts
 * @param currentFolder - The current folder being checked
 * @param folderEditState - The folder state tree
 * @returns True if there's a naming conflict among siblings
 */
export function isFolderNameNotUniq(
  name: string,
  currentFolder: { folderId: string; name: string },
  folderEditState: FolderEditTree,
): boolean {
  // Navigate to find siblings folder
  const segments = currentFolder.folderId.split('/');
  const siblingsFolders = segments.reduce<
    FolderNode | FolderEditTree | string | undefined
  >((current, segment) => {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return undefined;
    }
    return current[segment];
  }, folderEditState);

  // Check for name conflicts among siblings
  return (
    !!siblingsFolders &&
    Object.entries(siblingsFolders).some(([key, folderNode]) => {
      if (
        typeof folderNode !== 'object' ||
        key === EDITED_FOLDER_NAME_KEY ||
        currentFolder.name === key
      ) {
        return false;
      }
      const { [EDITED_FOLDER_NAME_KEY]: editStateName } = folderNode;
      return name.trim() === editStateName.trim();
    })
  );
}

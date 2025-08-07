import { Observable, forkJoin, of, switchMap } from 'rxjs';

import {
  isPlaybackConversation,
  isReplayConversation,
} from '@/src/utils/app/conversation';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import {
  ApiUtils,
  addVersionToId,
  getIdWithoutVersionFromApiKey,
  getPublicItemIdWithoutVersion,
  getVersionFromId,
  parseApplicationApiKey,
  parseConversationApiKey,
  parseFileApiKey,
  parsePromptApiKey,
  pathKeySeparator,
} from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { ApiKeys, FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';
import { PublishRequestDialAIEntityModel } from '@/src/types/models';
import { PromptInfo } from '@/src/types/prompt';
import {
  PublicVersionGroup,
  PublicVersionGroups,
  Publication,
  PublicationRequestModel,
  PublicationResource,
  PublicationRule,
  PublicationUpdateRequestModel,
  ResourceToReview,
  TargetAudienceFilter,
} from '@/src/types/publication';
import { SharingType } from '@/src/types/share';

import {
  EDITED_FOLDER_NAME_KEY,
  EntitiesEditState,
  FolderEditTree,
  FolderNode,
} from '@/src/store/publication/publication.types';

import {
  DEFAULT_VERSION,
  NA_VERSION,
  PUBLIC_URL_PREFIX,
} from '@/src/constants/publication';

import { isEntityNameValid, isVersionValid, prepareEntityName } from './common';
import { BucketService } from './data/bucket-service';
import { FileService } from './data/file-service';
import { constructPath } from './file';
import { getFolderIdFromEntityId, sortByName } from './folders';
import { getStringValidationErrors, getVersionValidationErrors } from './forms';
import {
  getEntityBucket,
  getRootId,
  isApplicationId,
  isConversationId,
  isEntityIdExternal,
  isFileId,
  isRootId,
} from './id';
import { EnumMapper } from './mappers';

import {
  ConversationInfo,
  PublishActions,
  ShareEntity,
} from '@epam/ai-dial-shared';
import mime from 'mime-types';

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

export const createTargetUrl = (
  featureType: FeatureType,
  publicPath: string,
  id: string,
  type: SharingType,
  version?: string,
) => {
  const baseElements =
    type === SharingType.PromptFolder || type === SharingType.ConversationFolder
      ? id.split('/').slice(2, -1)
      : '';
  const lastElement = id.split('/').slice(-1);
  const constructedUrlWithoutVersion = constructPath(
    EnumMapper.getApiKeyByFeatureType(featureType),
    PUBLIC_URL_PREFIX,
    publicPath,
    ...baseElements,
    ...lastElement,
  );

  if (featureType !== FeatureType.Chat && featureType !== FeatureType.Prompt) {
    return constructedUrlWithoutVersion;
  }

  if (version && isVersionValid(version)) {
    return addVersionToId(constructedUrlWithoutVersion, version);
  }

  return addVersionToId(constructedUrlWithoutVersion, DEFAULT_VERSION);
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

export const getNameWithoutModel = (itemName: string) => {
  const nameWithoutModel = itemName.slice(
    itemName.indexOf(pathKeySeparator) + 2,
  );

  return nameWithoutModel;
};

export const getConversationIdWithoutModel = (itemId: string) => {
  const nameWithoutModel = getNameWithoutModel(itemId);
  return itemId
    .slice(0, itemId.lastIndexOf('/'))
    .concat(`/${nameWithoutModel}`);
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
      const parseMethod =
        featureType === FeatureType.Chat
          ? parseConversationApiKey
          : parsePromptApiKey;

      const itemName = splitEntityId(item.id).name;

      const idWithoutModel =
        featureType === FeatureType.Chat
          ? getConversationIdWithoutModel(item.id)
          : item.id;

      const parsedApiKey = parseMethod(itemName, {
        parseVersion: true,
      });

      if (parsedApiKey.publicationInfo?.version) {
        const versionGroupKey = getPublicItemIdWithoutVersion(
          parsedApiKey.publicationInfo.version,
          idWithoutModel,
        );

        const currentVersionGroup = acc.publicVersionGroups[versionGroupKey];

        const newVersion = {
          version: parsedApiKey.publicationInfo.version,
          id: item.id,
        };

        if (!currentVersionGroup) {
          acc.publicVersionGroups[versionGroupKey] = {
            selectedVersion: newVersion,
            allVersions: [newVersion],
          };
        } else {
          const allVersions =
            currentVersionGroup.allVersions.concat(newVersion);

          const latestVersion = findLatestVersion(
            allVersions.map(({ version }) => version),
          );

          acc.publicVersionGroups[versionGroupKey] = {
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
        ...parsedApiKey,
        id: item.id,
        folderId,
        publishedWithMe: isRootId(folderId),
      } as T;

      if (featureType === FeatureType.Chat) {
        (itemToAdd as ConversationInfo).updatedAt = item.updatedAt;
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

export const getApplicationPublishResources = ({
  entity,
  publishAction,
  path,
}: {
  entity: PublishRequestDialAIEntityModel;
  publishAction: PublishActions;
  path: string;
}) => {
  const iconUrl = entity.iconUrl;

  const resources = [
    iconUrl && !isEntityIdExternal({ id: iconUrl }) ? iconUrl : undefined,
  ];

  return resources.reduce(
    (
      acc: {
        action: PublishActions;
        sourceUrl?: string | undefined;
        targetUrl: string;
      }[],
      id,
    ) => {
      if (id) {
        return [
          ...acc,
          {
            action: publishAction,
            targetUrl:
              publishAction === PublishActions.DELETE
                ? ApiUtils.decodeApiUrl(id)
                : createTargetUrl(FeatureType.File, path, id, SharingType.File),
            sourceUrl:
              publishAction === PublishActions.DELETE
                ? undefined
                : ApiUtils.decodeApiUrl(id),
          },
        ];
      }
      return acc;
    },
    [],
  );
};

export const getFilesFromPublicResources = ({
  fileResources,
  payloadUrl,
}: {
  fileResources: PublicationResource[];
  payloadUrl: string;
}): { publicFiles: DialFile[]; foldersSet: Set<string> } => {
  const foldersSet = new Set<string>();
  const publicFiles: DialFile[] = fileResources.map((r) => {
    const folderId = getFolderIdFromEntityId(r.reviewUrl);
    foldersSet.add(folderId); // Add folderId to the Set
    const fileName = splitEntityId(r.targetUrl).name;

    return {
      id: r.reviewUrl,
      absolutePath: folderId,
      folderId,
      name: fileName,
      contentLength: 0,
      contentType: mime.lookup(fileName.split('.').pop() ?? '') || '',
      isPublicationFile: true,
      publicationInfo: {
        action: r.action,
        publicationUrl: payloadUrl,
      },
    };
  });

  return { publicFiles, foldersSet };
};

export const getPublishFolderResources = (
  folder: FolderInterface,
  entities: (ShareEntity | DialFile | ConversationInfo)[],
  publicVersionGroups: PublicVersionGroups,
  isUnpublishing?: boolean,
) => {
  const folderPath = `${folder.id}/`;
  const sortedItems = sortByName(
    entities?.filter((item) => item.id.startsWith(folderPath)) || [],
  );

  if (isUnpublishing) {
    return sortedItems.filter((item) => {
      const currentVersionGroupId = item.publicationInfo?.version
        ? getPublicItemIdWithoutVersion(item.publicationInfo.version, item.id)
        : null;

      if (currentVersionGroupId) {
        const selectedVersion =
          publicVersionGroups[currentVersionGroupId]?.selectedVersion;

        return selectedVersion && selectedVersion.id === item.id;
      }

      return false;
    });
  }

  if (!isConversationId(folderPath)) {
    return sortedItems;
  }

  return (sortedItems as (ConversationInfo & Partial<Conversation>)[]).filter(
    (item) =>
      isPlaybackConversation(item) ||
      (!isReplayConversation(item) &&
        (item.messages?.length || !item.messages)),
  );
};

export const getVersionGroupFromId = (id: string) => {
  const featureType = EnumMapper.getFeatureTypeByApiKey(
    id.split('/')[0] as ApiKeys,
  );

  const parseMethod =
    featureType === FeatureType.Chat
      ? parseConversationApiKey
      : parsePromptApiKey;

  return {
    versionGroupId: getIdWithoutVersionFromApiKey(id, parseMethod),
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

  resources.forEach((item) => {
    const isConversation = isConversationId(item.reviewUrl);
    const isApplication = isApplicationId(item.reviewUrl);
    const isFile = isFileId(item.reviewUrl);
    const apiKey = splitEntityId(item.reviewUrl).name;

    const parseFunction = isConversation
      ? parseConversationApiKey
      : isApplication
        ? parseApplicationApiKey
        : isFile
          ? parseFileApiKey
          : parsePromptApiKey;
    const parsedApiKey = parseFunction(apiKey, {
      parseVersion: true,
    });

    allEditEntitiesMap[item.reviewUrl] = {
      name: parsedApiKey.name,
      version: isApplication
        ? getVersionFromId(item.reviewUrl)
        : (parsedApiKey.publicationInfo?.version ?? NA_VERSION),
    };
  });

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
    const parsedModelReference = parseConversationApiKey(modelName).model.id;
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

export const calculateNewFolderId = (
  entityId: string,
  foldersEditState: FolderEditTree,
  targetFolder: string,
  isDelete: boolean,
): string => {
  const folderSegments = getFolderIdFromEntityId(entityId).split('/');
  const newFolderSegments: string[] = [];
  let currentFolder = foldersEditState as FolderNode;

  folderSegments.forEach((segment, i) => {
    currentFolder = currentFolder[segment] as FolderNode;

    const folderName =
      i > 1
        ? prepareEntityName(currentFolder[EDITED_FOLDER_NAME_KEY])
        : currentFolder[EDITED_FOLDER_NAME_KEY];
    newFolderSegments.push(folderName);
  });

  if (isDelete) {
    newFolderSegments[1] = targetFolder;
  }
  return newFolderSegments.join('/');
};

export const checkVersionExists = (
  versionGroup: PublicVersionGroup | undefined,
  version: string,
  editState: EntitiesEditState,
  currentEntityId: string,
  folderId: string,
  name: string,
): boolean => {
  // Check public versions first
  const publicVersionExists = versionGroup?.allVersions?.some(
    (versionItem) => version === versionItem.version,
  );

  if (publicVersionExists) return true;

  // Check edit state versions
  return Object.entries(editState).some(
    ([key, { name: editName, version: editVersion }]) => {
      return (
        key !== currentEntityId &&
        getFolderIdFromEntityId(key) ===
          getFolderIdFromEntityId(currentEntityId) &&
        name === editName.trim() &&
        version === editVersion.trim()
      );
    },
  );
};

interface ValidationResult {
  versionExists: boolean;
  nameErrors: string[];
  versionErrors: string[];
}

export const getEditEntityValidation = ({
  entityId,
  name,
  version,
  editState,
  publicVersionGroups,
  versionGroupKey,
  newPublicFolderId,
  itemTypeName,
  action,
}: {
  entityId: string;
  name: string;
  version: string;
  editState: EntitiesEditState;
  publicVersionGroups: PublicVersionGroups;
  versionGroupKey: string;
  newPublicFolderId: string;
  itemTypeName: string;
  action?: PublishActions;
}): ValidationResult => {
  if (action === PublishActions.DELETE) {
    return {
      versionExists: false,
      nameErrors: [],
      versionErrors: [],
    };
  }

  const trimmedName = name.trim();
  const trimmedVersion = version.trim();

  const newFolderSegments = newPublicFolderId.split('/');
  newFolderSegments[1] = entityId.split('/')[1];
  const newFolderId = newFolderSegments.join('/');

  // Check version existence
  const versionExists = checkVersionExists(
    publicVersionGroups[versionGroupKey],
    trimmedVersion,
    editState,
    entityId,
    newFolderId,
    trimmedName,
  );

  // Validate name
  const nameErrors = getStringValidationErrors({
    value: name,
    label: `${itemTypeName}`,
    checkDotsAtTheEnd: true,
    isNotUniqName: versionExists,
    isPublic: true,
  });

  // Validate version
  const versionErrors = !isFileId(entityId)
    ? getVersionValidationErrors(
        trimmedVersion,
        versionExists,
        isApplicationId(entityId),
      )
    : [];

  return { versionExists, nameErrors, versionErrors };
};

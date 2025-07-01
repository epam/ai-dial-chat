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
  PublicVersionGroups,
  Publication,
  PublicationRequestModel,
  PublicationResource,
  PublicationRule,
  ResourceToReview,
  TargetAudienceFilter,
} from '@/src/types/publication';
import { SharingType } from '@/src/types/share';

import {
  EDITED_FOLDER_NAME_KEY,
  FolderEditTree,
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
      const parsedApiKey = parseMethod(splitEntityId(item.id).name, {
        parseVersion: true,
      });

      if (parsedApiKey.publicationInfo?.version) {
        const idWithoutVersion = getPublicItemIdWithoutVersion(
          parsedApiKey.publicationInfo.version,
          item.id,
        );
        const currentVersionGroup = acc.publicVersionGroups[idWithoutVersion];

        const newVersion = {
          version: parsedApiKey.publicationInfo.version,
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

    return {
      id: r.reviewUrl,
      folderId,
      name: splitEntityId(r.targetUrl).name,
      contentLength: 0,
      contentType: '',
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
export const processPublicationResources = (
  payload: PublicationRequestModel,
): Observable<{
  publicationData: PublicationRequestModel;
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

      const publicationData: PublicationRequestModel = {
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

import { getQuickAppDocumentUrl } from '@/src/utils/app/application';

import { CustomApplicationModel } from '@/src/types/applications';
import { FeatureType } from '@/src/types/common';
import { PublishRequestDialAIEntityModel } from '@/src/types/models';
import { PromptInfo } from '@/src/types/prompt';
import {
  PublicVersionGroups,
  PublicationResource,
  ResourceToReview,
} from '@/src/types/publication';
import { SharingType } from '@/src/types/share';

import {
  DEFAULT_VERSION,
  NA_VERSION,
  PUBLIC_URL_PREFIX,
} from '@/src/constants/public';

import {
  ApiUtils,
  addVersionToId,
  getPublicItemIdWithoutVersion,
  parseConversationApiKey,
  parsePromptApiKey,
} from '../server/api';
import { isVersionValid } from './common';
import { constructPath } from './file';
import { getFolderIdFromEntityId, splitEntityId } from './folders';
import { getEntityBucket, getRootId, isEntityIdExternal, isRootId } from './id';
import { EnumMapper } from './mappers';

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
  items: { id: string; lastActivityDate?: number }[],
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
        (itemToAdd as ConversationInfo).lastActivityDate =
          item.lastActivityDate;
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
  applicationDetails,
  selectedIds,
}: {
  entity: PublishRequestDialAIEntityModel;
  publishAction: PublishActions;
  path: string;
  selectedIds: string[];
  applicationDetails?: CustomApplicationModel;
}) => {
  const iconUrl = entity.iconUrl;
  const documentUrl = getQuickAppDocumentUrl(applicationDetails);

  const resources = [
    iconUrl && !isEntityIdExternal({ id: iconUrl }) ? iconUrl : undefined,
    documentUrl && selectedIds.includes(documentUrl) ? documentUrl : undefined,
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

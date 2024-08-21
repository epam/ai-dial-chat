import { ConversationInfo } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { PromptInfo } from '@/src/types/prompt';
import { PublicVersionGroups, PublishedItem } from '@/src/types/publication';
import { SharingType } from '@/src/types/share';

import {
  DEFAULT_VERSION,
  NA_VERSION,
  PUBLIC_URL_PREFIX,
} from '@/src/constants/public';

import {
  addVersionToId,
  getPublicItemIdWithoutVersion,
  parseConversationApiKey,
  parsePromptApiKey,
} from '../server/api';
import { constructPath } from './file';
import { getFolderIdFromEntityId, splitEntityId } from './folders';
import { isRootId } from './id';
import { EnumMapper } from './mappers';

import orderBy from 'lodash-es/orderBy';

export const isItemPublic = (id: string) =>
  id.split('/')[1] === PUBLIC_URL_PREFIX;

export const createTargetUrl = (
  featureType: FeatureType,
  publicPath: string,
  id: string,
  version: string | undefined,
  type?: SharingType,
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

  if (version) {
    const versionParts = version.split('.');

    if (
      versionParts.length === 3 &&
      versionParts.filter(Boolean).every((part) => /^\d+$/.test(part))
    ) {
      return addVersionToId(constructedUrlWithoutVersion, version);
    }
  }

  return addVersionToId(constructedUrlWithoutVersion, DEFAULT_VERSION);
};

export const findLatestVersion = (versions: string[]) => {
  const filteredVersions = versions.filter((v) => v !== NA_VERSION);

  if (!filteredVersions.length) {
    return NA_VERSION;
  }

  const sortedVersions = orderBy(
    filteredVersions,
    [(version) => version.split('.').map(Number)],
    ['asc'],
  );

  return sortedVersions.pop();
};

export const mapPublishedItems = <T extends PromptInfo | ConversationInfo>(
  items: PublishedItem[],
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
      const parsedApiKey = parseMethod(splitEntityId(item.url).name, {
        parseVersion: true,
      });

      if (parsedApiKey.publicationInfo?.version) {
        const idWithoutVersion = getPublicItemIdWithoutVersion(
          parsedApiKey.publicationInfo.version,
          item.url,
        );
        const currentVersionGroup = acc.publicVersionGroups[idWithoutVersion];

        if (!currentVersionGroup) {
          acc.publicVersionGroups[idWithoutVersion] = {
            selectedVersion: {
              version: parsedApiKey.publicationInfo.version,
              id: item.url,
            },
            allVersions: [
              {
                version: parsedApiKey.publicationInfo.version,
                id: item.url,
              },
            ],
          };
        } else {
          acc.publicVersionGroups[idWithoutVersion] = {
            ...currentVersionGroup,
            allVersions: [
              ...currentVersionGroup.allVersions,
              {
                version: parsedApiKey.publicationInfo.version,
                id: item.url,
              },
            ],
          };
        }
      }

      acc.items.push({
        ...parsedApiKey,
        id: item.url,
        folderId: getFolderIdFromEntityId(item.url),
        publishedWithMe: isRootId(getFolderIdFromEntityId(item.url)),
      } as T);

      return acc;
    },
    {
      publicVersionGroups: {},
      items: [],
    },
  );

export const getPublicationId = (url: string) =>
  url.split('/').slice(-1).shift();

import { ConversationInfo } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { PromptInfo } from '@/src/types/prompt';
import { PublicVersionGroups } from '@/src/types/publication';
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
  itemId: string[],
  featureType: FeatureType,
  idToBeForceSelected?: string,
) =>
  itemId.reduce<{
    publicVersionGroups: PublicVersionGroups;
    items: T[];
  }>(
    (acc, itemId) => {
      const parseMethod =
        featureType === FeatureType.Chat
          ? parseConversationApiKey
          : parsePromptApiKey;
      const parsedApiKey = parseMethod(splitEntityId(itemId).name, {
        parseVersion: true,
      });

      if (parsedApiKey.publicationInfo?.version) {
        const idWithoutVersion = getPublicItemIdWithoutVersion(
          parsedApiKey.publicationInfo.version,
          itemId,
        );
        const currentVersionGroup = acc.publicVersionGroups[idWithoutVersion];

        if (!currentVersionGroup) {
          acc.publicVersionGroups[idWithoutVersion] = {
            selectedVersion: {
              version: parsedApiKey.publicationInfo.version,
              id: itemId,
            },
            allVersions: [
              {
                version: parsedApiKey.publicationInfo.version,
                id: itemId,
              },
            ],
          };
        } else {
          if (idToBeForceSelected) {
            const versionToBeForceSelected = parseMethod(
              splitEntityId(idToBeForceSelected).name,
              {
                parseVersion: true,
              },
            ).publicationInfo?.version;

            acc.publicVersionGroups[idWithoutVersion] = {
              selectedVersion: {
                version: versionToBeForceSelected ?? NA_VERSION,
                id: idToBeForceSelected,
              },
              allVersions: [
                ...currentVersionGroup.allVersions,
                {
                  version: parsedApiKey.publicationInfo.version,
                  id: itemId,
                },
              ],
            };
          } else {
            const latestVersion = findLatestVersion([
              ...currentVersionGroup.allVersions.map(({ version }) => version),
              parsedApiKey.publicationInfo.version,
            ]);

            acc.publicVersionGroups[idWithoutVersion] = {
              selectedVersion:
                latestVersion === currentVersionGroup.selectedVersion.version
                  ? currentVersionGroup.selectedVersion
                  : {
                      version: parsedApiKey.publicationInfo.version,
                      id: itemId,
                    },
              allVersions: [
                ...currentVersionGroup.allVersions,
                {
                  version: parsedApiKey.publicationInfo.version,
                  id: itemId,
                },
              ],
            };
          }
        }
      }

      const folderId = getFolderIdFromEntityId(itemId);

      acc.items.push({
        ...parsedApiKey,
        id: itemId,
        folderId,
        publishedWithMe: isRootId(folderId),
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

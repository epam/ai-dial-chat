import React, { useMemo } from 'react';

import {
  getFolderIdFromEntityId,
  getFoldersFromIds,
  getParentFolderIdsFromFolderId,
} from '@/src/utils/app/folders';
import {
  isApplicationId,
  isConversationId,
  isFileId,
  isRootEntity,
  isToolsetId,
} from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import {
  getIdWithoutVersionFromApiKey,
  parseEntityApiKey,
} from '@/src/utils/server/api';

import { PublicationResource } from '@/src/types/publication';

import { useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/selectors';

import { PublicationFolderRow } from '@/src/components/Chat/Publish/PublicationHandler/ReviewRowItems/PublicationFolderRow';

import { PublicationItemProps } from './ReviewRowItems/view-props';

import {
  PublishActions,
  ShareEntity,
  UploadStatus,
} from '@epam/ai-dial-shared';
import uniq from 'lodash-es/uniq';
import uniqBy from 'lodash-es/uniqBy';

interface Props {
  resources: PublicationResource[];
  ItemComponent: React.FC<PublicationItemProps>;
  publicationUrl: string;
}

export const BasePublicationResources = ({
  resources,
  ItemComponent,
  publicationUrl,
}: Props) => {
  const publicationModel = useAppSelector(
    PublicationSelectors.selectPublishModel,
  );
  const currentPublicationInvalidEntities = useAppSelector(
    PublicationSelectors.selectCurrentPublicationInvalidEntities,
  );

  const { apiKey } = splitEntityId(resources[0].reviewUrl);

  const entities: ShareEntity[] = useMemo(
    () =>
      resources.map(({ reviewUrl, action, publishCredentials }) => {
        const { name, version } = parseEntityApiKey(
          splitEntityId(reviewUrl).name,
          {
            parseVersion:
              !publicationModel ||
              publicationModel.action === PublishActions.DELETE ||
              isApplicationId(reviewUrl) ||
              isToolsetId(reviewUrl),
            parseModel: isConversationId(reviewUrl),
          },
        );

        return {
          id: reviewUrl,
          folderId: getFolderIdFromEntityId(reviewUrl),
          name,
          publicationInfo: {
            isNotExist: currentPublicationInvalidEntities.includes(reviewUrl),
            action,
            publishCredentials,
            version,
          },
        };
      }),
    [currentPublicationInvalidEntities, publicationModel, resources],
  );

  const rootEntities = useMemo(
    () =>
      uniqBy(
        entities.filter(
          (entity) =>
            isRootEntity(entity.id) ||
            (publicationModel &&
              !publicationModel.isFolder &&
              isFileId(entity.id)),
        ),
        (entity) => getIdWithoutVersionFromApiKey(entity.id),
      ),
    [entities, publicationModel],
  );

  const directContainerFolderIds = useMemo(
    () => uniq(entities.map((entity) => entity.folderId).filter(Boolean)),
    [entities],
  );

  const folders = useMemo(
    () =>
      getFoldersFromIds(
        uniq(
          entities
            .map((entity) => entity.folderId)
            .flatMap((id) => getParentFolderIdsFromFolderId(id)),
        ),
        EnumMapper.getFeatureTypeByApiKey(apiKey),
        UploadStatus.LOADED,
      ),
    [apiKey, entities],
  );
  const rootFolders = useMemo(
    () =>
      folders.filter(
        (folder) =>
          isRootEntity(folder.id) &&
          !(
            publicationModel &&
            !publicationModel.isFolder &&
            isFileId(folder.id)
          ),
      ),
    [folders, publicationModel],
  );

  const displayFolderEntities = useMemo(() => {
    return uniqBy(entities, (entity) =>
      getIdWithoutVersionFromApiKey(entity.id),
    );
  }, [entities]);

  return (
    <>
      {rootFolders.map((folder) => (
        <PublicationFolderRow
          publicationUrl={publicationUrl}
          key={folder.id}
          currentFolder={folder}
          allFolders={folders}
          displayItems={displayFolderEntities}
          allItems={entities}
          directContainerFolderIds={directContainerFolderIds}
          ItemComponent={ItemComponent}
          level={0}
        />
      ))}
      {rootEntities.map((item) => (
        <ItemComponent
          key={item.id}
          item={item}
          level={0}
          publicationUrl={publicationUrl}
        />
      ))}
    </>
  );
};

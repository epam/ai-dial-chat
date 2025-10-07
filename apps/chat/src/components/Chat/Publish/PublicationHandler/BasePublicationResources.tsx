import { useMemo } from 'react';

import {
  getFolderIdFromEntityId,
  getFoldersFromIds,
  getParentFolderIdsFromFolderId,
} from '@/src/utils/app/folders';
import {
  isApplicationId,
  isConversationId,
  isRootEntity,
  isToolsetId,
} from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import { parseEntityApiKey } from '@/src/utils/server/api';

import { PublicationResource } from '@/src/types/publication';

import { useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/selectors';

import { PublicationFolderRow } from '@/src/components/Chat/Publish/PublicationHandler/ReviewRowItems/PublicationFolderRow';

import { ShareEntity, UploadStatus } from '@epam/ai-dial-shared';
import uniq from 'lodash-es/uniq';

interface Props {
  resources: PublicationResource[];
  ItemComponent: React.FC<{ item: ShareEntity; level: number }>;
}

export const BasePublicationResources = ({
  resources,
  ItemComponent,
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
      resources.map(({ reviewUrl, action }) => {
        const { name } = parseEntityApiKey(splitEntityId(reviewUrl).name, {
          parseVersion:
            !publicationModel ||
            isApplicationId(reviewUrl) ||
            isToolsetId(reviewUrl),
          parseModel: isConversationId(reviewUrl),
        });

        return {
          id: reviewUrl,
          folderId: getFolderIdFromEntityId(reviewUrl),
          name,
          publicationInfo: {
            isNotExist: currentPublicationInvalidEntities.has(reviewUrl),
            action,
          },
        };
      }),
    [currentPublicationInvalidEntities, publicationModel, resources],
  );
  const rootEntities = useMemo(
    () => entities.filter((entity) => isRootEntity(entity.id)),
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
    () => folders.filter((folder) => isRootEntity(folder.id)),
    [folders],
  );

  return (
    <>
      {rootFolders.map((folder) => (
        <PublicationFolderRow
          key={folder.id}
          currentFolder={folder}
          allFolders={folders}
          allItems={entities}
          ItemComponent={ItemComponent}
          level={0}
        />
      ))}
      {rootEntities.map((item) => {
        return <ItemComponent key={item.id} item={item} level={0} />;
      })}
    </>
  );
};

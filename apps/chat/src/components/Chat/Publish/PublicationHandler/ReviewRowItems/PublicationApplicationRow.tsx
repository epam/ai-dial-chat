import { useMemo } from 'react';

import { getFolderIdFromEntityId } from '@/src/utils/app/folders';

import { BackendResourceTypeName, EntityType } from '@/src/types/common';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/selectors';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';

import { PublicationItemRow } from './PublicationItemRow';
import { PublicationItemProps } from './view-props';

export const PublicationApplicationRow: React.FC<PublicationItemProps> = ({
  item,
  level,
  publicationUrl,
}) => {
  const models = useAppSelector(ModelsSelectors.selectModels);
  const publishRequestModels = useAppSelector(
    ModelsSelectors.selectPublishRequestModels,
  );

  const agent = useMemo(() => {
    return [...publishRequestModels, ...models].find(
      (agent) => item.id === agent.id,
    );
  }, [publishRequestModels, models, item.id]);

  const entity = useMemo(
    () => ({
      ...item,
      folderId: getFolderIdFromEntityId(item.name),
      iconUrl: agent?.iconUrl,
      type: EntityType.Application,
    }),
    [agent?.iconUrl, item],
  );

  return (
    <PublicationItemRow
      level={level}
      Icon={<ModelIcon entity={entity} entityId={item.id} size={18} />}
      item={item}
      itemTypeName={BackendResourceTypeName.APPLICATION}
      dataQa="application"
      publicationUrl={publicationUrl}
    />
  );
};

import { useMemo } from 'react';

import { getFolderIdFromEntityId } from '@/src/utils/app/folders';

import { EntityType } from '@/src/types/common';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';

import { PublicationItemRow } from './PublicationItemRow';

import { ShareEntity } from '@epam/ai-dial-shared';

interface Props {
  item: ShareEntity;
  level: number;
}

export const PublicationApplicationRow: React.FC<Props> = ({ item, level }) => {
  const entity = useMemo(
    () => ({
      ...item,
      folderId: getFolderIdFromEntityId(item.name),
      type: EntityType.Application,
    }),
    [item],
  );

  return (
    <PublicationItemRow
      level={level}
      Icon={<ModelIcon entity={entity} entityId={item.id} size={18} />}
      item={item}
      dataQa="application"
    />
  );
};

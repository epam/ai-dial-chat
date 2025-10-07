import { useMemo } from 'react';

import { getFolderIdFromEntityId } from '@/src/utils/app/folders';

import { BackendResourceTypeName, EntityType } from '@/src/types/common';

import { useAppSelector } from '@/src/store/hooks';
import { ToolsetSelectors } from '@/src/store/selectors';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';

import { PublicationItemRow } from './PublicationItemRow';

import { ShareEntity } from '@epam/ai-dial-shared';

interface Props {
  item: ShareEntity;
  level: number;
}

export const PublicationToolsetRow: React.FC<Props> = ({ item, level }) => {
  const toolsets = useAppSelector(ToolsetSelectors.selectToolsets);
  const publishRequestToolsets = useAppSelector(
    ToolsetSelectors.selectPublishRequestToolsets,
  );

  const agent = useMemo(() => {
    return [...publishRequestToolsets, ...toolsets].find(
      (agent) => item.id === agent.id,
    );
  }, [publishRequestToolsets, toolsets, item.id]);

  const entity = useMemo(
    () => ({
      ...item,
      folderId: getFolderIdFromEntityId(item.name),
      iconUrl: agent?.iconUrl,
      type: EntityType.Toolset,
    }),
    [item, agent?.iconUrl],
  );

  return (
    <PublicationItemRow
      level={level}
      Icon={<ModelIcon entity={entity} entityId={item.id} size={18} />}
      item={item}
      itemTypeName={BackendResourceTypeName.TOOLSET}
      dataQa="toolset"
    />
  );
};

import { useMemo } from 'react';

import { getFolderIdFromEntityId } from '@/src/utils/app/folders';

import { BackendResourceTypeName, EntityType } from '@/src/types/common';

import { useAppSelector } from '@/src/store/hooks';
import { ToolsetSelectors } from '@/src/store/selectors';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';

import { PublicationCredentialsRow } from './PublicationCredentialsRow';
import { PublicationItemRow } from './PublicationItemRow';
import { PublicationItemProps } from './view-props';

export const PublicationToolsetRow: React.FC<PublicationItemProps> = ({
  item,
  level,
}) => {
  const toolsets = useAppSelector(ToolsetSelectors.selectToolsets);
  const publishRequestToolsets = useAppSelector(
    ToolsetSelectors.selectPublishRequestToolsets,
  );

  const foundToolset = useMemo(() => {
    return [...publishRequestToolsets, ...toolsets].find(
      (toolset) => item.id === toolset.id,
    );
  }, [publishRequestToolsets, toolsets, item.id]);

  const entity = useMemo(
    () => ({
      ...item,
      folderId: getFolderIdFromEntityId(item.name),
      iconUrl: foundToolset?.iconUrl,
      type: EntityType.Toolset,
    }),
    [item, foundToolset?.iconUrl],
  );

  return (
    <>
      <PublicationItemRow
        level={level}
        Icon={<ModelIcon entity={entity} entityId={item.id} size={18} />}
        item={item}
        itemTypeName={BackendResourceTypeName.TOOLSET}
        dataQa="toolset"
      />
      {item.publicationInfo?.publishCredentials && (
        <PublicationCredentialsRow level={level + 1} itemId={item.id} />
      )}
    </>
  );
};

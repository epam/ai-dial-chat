import { useMemo } from 'react';

import { getFolderIdFromEntityId } from '@/src/utils/app/folders';

import { EntityType } from '@/src/types/common';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';

import { PublicationItemRow } from './PublicationItemRow';

import { ShareEntity } from '@epam/ai-dial-shared';

interface Props {
  application: ShareEntity;
  level: number;
}

export const PublicationApplicationRow: React.FC<Props> = ({
  application,
  level,
}) => {
  const entity = useMemo(
    () => ({
      ...application,
      folderId: getFolderIdFromEntityId(application.name),
      type: EntityType.Application,
    }),
    [application],
  );

  return (
    <PublicationItemRow
      level={level}
      name={application.name}
      Icon={<ModelIcon entity={entity} entityId={application.id} size={18} />}
      publicationInfo={application.publicationInfo}
      dataQa="application"
      editedName={application.name}
      isEditMode={false}
    />
  );
};

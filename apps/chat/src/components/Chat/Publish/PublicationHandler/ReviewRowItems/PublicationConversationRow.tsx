import { useMemo } from 'react';

import { splitEntityId } from '@/src/utils/app/shared-utils';
import { parseEntityApiKey } from '@/src/utils/server/api';

import { BackendResourceTypeName } from '@/src/types/common';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.selectors';

import { PlaybackIcon } from '@/src/components/Chat/Playback/PlaybackIcon';
import { ReplayAsIsIcon } from '@/src/components/Chat/ReplayAsIsIcon';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';

import { PublicationItemRow } from './PublicationItemRow';
import { PublicationItemProps } from './view-props';

export const PublicationConversationRow: React.FC<PublicationItemProps> = ({
  item,
  level,
}) => {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const { name } = splitEntityId(item.id);
  const { modelInfo } = useMemo(
    () => parseEntityApiKey(name, { parseModel: true }),
    [name],
  );
  const entity = useMemo(() => {
    return {
      ...item,
      ...modelInfo,
    };
  }, [item, modelInfo]);

  const Icon = useMemo(() => {
    if (entity.isReplay) {
      return <ReplayAsIsIcon size={18} />;
    }

    if (entity.isPlayback) {
      return <PlaybackIcon size={18} />;
    }

    return (
      <ModelIcon
        size={18}
        entityId={entity.model.id}
        entity={modelsMap[entity.model.id]}
      />
    );
  }, [entity.isReplay, entity.isPlayback, entity.model.id, modelsMap]);

  return (
    <PublicationItemRow
      level={level}
      Icon={Icon}
      item={entity}
      itemTypeName={BackendResourceTypeName.CONVERSATION}
      dataQa="conversation"
    />
  );
};

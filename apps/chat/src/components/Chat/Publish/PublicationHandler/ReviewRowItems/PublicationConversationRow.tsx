import { useMemo } from 'react';

import {
  isPlaybackConversation,
  isReplayConversation,
} from '@/src/utils/app/conversation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.selectors';

import { PlaybackIcon } from '@/src/components/Chat/Playback/PlaybackIcon';
import { ReplayAsIsIcon } from '@/src/components/Chat/ReplayAsIsIcon';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';

import { PublicationItemRow } from './PublicationItemRow';

import { ConversationInfo } from '@epam/ai-dial-shared';

interface Props {
  item: ConversationInfo;
  level: number;
}

export const PublicationConversationRow: React.FC<Props> = ({
  item,
  level,
}) => {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const isReplay = isReplayConversation(item);
  const isPlayback = isPlaybackConversation(item);

  const Icon = useMemo(() => {
    if (isReplay) {
      return <ReplayAsIsIcon size={18} />;
    }

    if (isPlayback) {
      return <PlaybackIcon size={18} />;
    }

    return (
      <ModelIcon
        size={18}
        entityId={item.model.id}
        entity={modelsMap[item.model.id]}
      />
    );
  }, [isReplay, isPlayback, item.model.id, modelsMap]);

  return (
    <PublicationItemRow
      level={level}
      Icon={Icon}
      item={item}
      dataQa="conversation"
    />
  );
};

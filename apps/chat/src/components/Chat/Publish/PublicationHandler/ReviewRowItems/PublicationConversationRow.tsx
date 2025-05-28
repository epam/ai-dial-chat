import { useCallback, useMemo } from 'react';

import {
  isPlaybackConversation,
  isReplayConversation,
} from '@/src/utils/app/conversation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.selectors';

import { PlaybackIcon } from '@/src/components/Chat/Playback/PlaybackIcon';
import { ReplayAsIsIcon } from '@/src/components/Chat/ReplayAsIsIcon';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { ShareIcon } from '@/src/components/Common/ShareIcon';

import { PublicationItemRow } from './PublicationItemRow';

import { ConversationInfo, FeatureType } from '@epam/ai-dial-shared';

interface Props {
  conversation: ConversationInfo;
  level: number;
  isEditable: boolean;
  editedName: string;
}

export const PublicationConversationRow: React.FC<Props> = ({
  conversation,
  level,
  isEditable,
  editedName,
}) => {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const isReplay = isReplayConversation(conversation);
  const isPlayback = isPlaybackConversation(conversation);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  const handleEdit = useCallback((newName: string) => {}, []);

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
        entityId={conversation.model.id}
        entity={modelsMap[conversation.model.id]}
      />
    );
  }, [isReplay, isPlayback, conversation.model.id, modelsMap]);

  return (
    <ShareIcon
      featureType={FeatureType.Chat}
      isHighlighted={false}
      iconClassName="bg-layer-2"
      iconWrapperClassName="!bg-layer-2"
      {...conversation}
    >
      <PublicationItemRow
        level={level}
        isEditable={isEditable}
        editedName={editedName}
        name={conversation.name}
        Icon={Icon}
        publicationInfo={conversation.publicationInfo}
      />
    </ShareIcon>
  );
};

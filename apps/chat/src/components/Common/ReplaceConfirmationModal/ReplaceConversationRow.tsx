import {
  isPlaybackConversation,
  isReplayConversation,
} from '@/src/utils/app/conversation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.selectors';

import { PlaybackIcon } from '@/src/components/Chat/Playback/PlaybackIcon';
import { ReplayAsIsIcon } from '@/src/components/Chat/ReplayAsIsIcon';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';

import { ShareIcon } from '../ShareIcon';
import { Tooltip } from '../Tooltip';
import { EntityRow, FeatureRowProps } from './ReplaceEntityRow';
import { FeatureContainer } from './ReplaceRowContainer';

import { ConversationInfo, FeatureType } from '@epam/ai-dial-shared';

interface ConversationViewProps {
  item: ConversationInfo;
}

const ConversationView = ({ item: conversation }: ConversationViewProps) => {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const isReplay = isReplayConversation(conversation);
  const isPlayback = isPlaybackConversation(conversation);

  return (
    <FeatureContainer>
      <ShareIcon
        featureType={FeatureType.Chat}
        isHighlighted={false}
        iconClassName="bg-layer-2"
        iconWrapperClassName="!bg-layer-2"
        {...conversation}
      >
        {isReplay && (
          <span className="flex shrink-0">
            <ReplayAsIsIcon size={18} />
          </span>
        )}
        {isPlayback && (
          <span className="flex shrink-0">
            <PlaybackIcon size={18} />
          </span>
        )}
        {!isReplay && !isPlayback && (
          <ModelIcon
            size={18}
            entityId={conversation.model.id}
            entity={modelsMap[conversation.model.id]}
          />
        )}
      </ShareIcon>
      <Tooltip
        tooltip={conversation.name}
        contentClassName="break-all"
        triggerClassName="truncate whitespace-pre"
        dataQa="entity-name"
      >
        {conversation.name}
      </Tooltip>
    </FeatureContainer>
  );
};

interface ConversationRowProps extends ConversationViewProps, FeatureRowProps {}

export const ConversationRow = ({
  item: conversation,
  additionalItemData,
  onEvent,
}: ConversationRowProps) => {
  return (
    <EntityRow
      entityId={conversation.id}
      additionalItemData={additionalItemData}
      onEvent={onEvent}
      dataQA="conversation"
    >
      <ConversationView item={conversation} />
    </EntityRow>
  );
};

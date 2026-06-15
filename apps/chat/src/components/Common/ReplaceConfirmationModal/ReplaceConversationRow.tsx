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
  featureContainerClassNames?: string;
}

const ConversationView = ({
  item: conversation,
  featureContainerClassNames,
}: ConversationViewProps) => {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const isReplay = isReplayConversation(conversation);
  const isPlayback = isPlaybackConversation(conversation);

  return (
    <FeatureContainer className={featureContainerClassNames}>
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

interface ConversationRowProps extends ConversationViewProps, FeatureRowProps {
  featureContainerClassNames?: string;
  itemComponentClassNames?: string;
}

export const ConversationRow = ({
  item: conversation,
  additionalItemData,
  itemComponentClassNames,
  featureContainerClassNames,
  level,
  onEvent,
}: ConversationRowProps) => {
  return (
    <EntityRow
      entityId={conversation.id}
      additionalItemData={additionalItemData}
      itemComponentClassNames={itemComponentClassNames}
      level={level}
      dataQA="conversation"
      onEvent={onEvent}
    >
      <ConversationView
        item={conversation}
        featureContainerClassNames={featureContainerClassNames}
      />
    </EntityRow>
  );
};

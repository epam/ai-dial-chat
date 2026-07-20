import React from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isMarketplaceEntityPublic } from '@/src/utils/app/application';
import {
  isPlaybackConversation,
  isReplayAsIsConversation,
} from '@/src/utils/app/conversation';
import { isApplicationId, isMyApplication } from '@/src/utils/app/id';
import { PseudoModel, isPseudoModel } from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { DialAIEntityModel } from '@/src/types/models';
import { CardType } from '@/src/types/talkTo';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { AuthSelectors, ModelsSelectors } from '@/src/store/selectors';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';
import { ChatI18nKeys } from '@/src/constants/i18n';
import { SuggestedCard } from '@/src/constants/talkTo';

import { SuggestionButton } from '@/src/components/Common/SuggestionButton';

import { ItemCardView } from './ItemCardView';

export interface TalkToSliderItemProps {
  groupItem: CardType;
  isMyWorkspace: boolean;
  conversation: Conversation;
  onSelectModel: (entity: DialAIEntityModel) => void;
  onOpenMarketplaceTab: () => void;
}

export const TalkToSliderItem = ({
  groupItem,
  onSelectModel,
  onOpenMarketplaceTab,
  conversation,
}: TalkToSliderItemProps) => {
  const { t } = useTranslation(Translation.Chat);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);

  const isNotPseudoModelSelected =
    groupItem.reference === conversation.model.id &&
    !isPlaybackConversation(conversation) &&
    !isReplayAsIsConversation(conversation);
  const isPseudoModelSelected =
    groupItem.reference === PseudoModel.Playback ||
    (groupItem.reference === REPLAY_AS_IS_MODEL &&
      isReplayAsIsConversation(conversation));

  const isSelected = isNotPseudoModelSelected || isPseudoModelSelected;

  const isNotPublishedCustomApplication =
    isApplicationId(groupItem.id) &&
    isMyApplication(groupItem) &&
    !isMarketplaceEntityPublic(groupItem as DialAIEntityModel);

  const isUnavailableModel =
    !modelsMap[groupItem.reference] &&
    !isPseudoModel(groupItem.id) &&
    groupItem.reference !== REPLAY_AS_IS_MODEL;

  if (groupItem === SuggestedCard) {
    return (
      <div
        className="flex size-full cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-primary hover:bg-layer-3"
        onClick={onOpenMarketplaceTab}
        key={SuggestedCard.id}
      >
        <h3 className="text-base">{t(ChatI18nKeys.CouldntFindWhatYouNeed)}</h3>
        <SuggestionButton />
      </div>
    );
  }

  return (
    <ItemCardView
      isSelected={isSelected}
      conversation={conversation}
      hasError={isUnavailableModel}
      isUnavailableModel={isUnavailableModel}
      disabled={
        isPlaybackConversation(conversation) &&
        groupItem.reference !== PseudoModel.Playback
      }
      tooltip={
        isPlaybackConversation(conversation) &&
        groupItem.reference !== PseudoModel.Playback
          ? t(ChatI18nKeys.EditingNotAvailableInPlayback)
          : undefined
      }
      key={groupItem.id}
      entity={groupItem as DialAIEntityModel}
      onClick={onSelectModel}
      overrideDisabledActions={{
        unpublish: !isAdmin,
        ...(isNotPublishedCustomApplication && {
          edit: true,
          delete: true,
          publish: true,
        }),
      }}
    />
  );
};

import { useCallback, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';

import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getConversationModelParams,
  isPlaybackConversation,
  isReplayAsIsConversation,
  isReplayConversation,
} from '@/src/utils/app/conversation';

import { Conversation } from '@/src/types/chat';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ConversationsActions, ModelsActions } from '@/src/store/actions';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/selectors';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';
import { ChatI18nKeys } from '@/src/constants/i18n';
import {
  MarketplaceQueryParams,
  MarketplaceTabs,
} from '@/src/constants/marketplace';

import { SelectModelSlider } from '@/src/components/Chat/SelectModelSlider/SelectModelSlider';

import { TalkToSliderItem, TalkToSliderItemProps } from './TalkToSliderItem';

interface TalkToModalProps {
  conversation: Conversation;
  isCompareMode: boolean;
  isRight: boolean;
  onClose: () => void;
}

export const TalkToModal = ({
  conversation,
  isCompareMode,
  isRight,
  onClose,
}: TalkToModalProps) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useDispatch();
  const router = useRouter();

  const [tab, setTab] = useState(MarketplaceTabs.MY_WORKSPACE);
  const isMyWorkspace = tab === MarketplaceTabs.MY_WORKSPACE;

  const allModels = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const installedModelIdsSet = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );

  const isPlayback = isPlaybackConversation(conversation);
  const isReplay = isReplayConversation(conversation);

  const handleSelectModel = useCallback(
    (entity: DialAIEntityModel) => {
      const model = modelsMap[entity.reference];

      if (
        (model || entity.reference === REPLAY_AS_IS_MODEL) &&
        (conversation.model.id !== entity.reference ||
          isReplayAsIsConversation(conversation))
      ) {
        dispatch(
          ConversationsActions.updateConversation({
            id: conversation.id,
            values: {
              ...getConversationModelParams(
                conversation,
                entity.reference,
                modelsMap,
              ),
            },
            publicationUrl: conversation.publicationInfo?.publicationUrl,
          }),
        );
      }
      dispatch(ConversationsActions.setIsStartedCustomViewerConversation(true));
      if (
        model &&
        model.reference !== REPLAY_AS_IS_MODEL &&
        !installedModelIdsSet.has(model.reference)
      ) {
        dispatch(
          ModelsActions.addInstalledModels({
            references: [model.reference],
            showSuccessToast: false,
            updateRecentModels: true,
          }),
        );
      }

      onClose();
    },
    [conversation, dispatch, installedModelIdsSet, modelsMap, onClose],
  );

  const handleGoToWorkspace = useCallback(() => {
    if (!isPlayback) {
      const url = `/marketplace?${MarketplaceQueryParams.fromConversation}=${encodeURIComponent(conversation.id)}${isMyWorkspace ? `&${MarketplaceQueryParams.tab}=${tab}` : ''}`;

      router.push(url);
      dispatch(ConversationsActions.setTalkToConversationId(null));
    }
  }, [conversation.id, isMyWorkspace, tab, router, isPlayback, dispatch]);

  const sliderItemProps = useMemo(
    () => ({
      conversation,
      onSelectModel: handleSelectModel,
      onOpenMarketplaceTab: () => setTab(MarketplaceTabs.HOME),
      isMyWorkspace,
    }),
    [conversation, handleSelectModel, setTab, isMyWorkspace],
  );

  const title = t(
    isCompareMode
      ? isRight
        ? ChatI18nKeys.SelectAgentForRightSideConversation
        : ChatI18nKeys.SelectAgentForLeftSideConversation
      : ChatI18nKeys.SelectAgentForConversation,
  );

  return (
    <SelectModelSlider<Omit<TalkToSliderItemProps, 'groupItem'>>
      onClose={onClose}
      tab={tab}
      setTab={setTab}
      models={allModels}
      currentModelId={conversation.model.id}
      SliderItem={TalkToSliderItem}
      itemProps={sliderItemProps}
      title={title}
      isPlayback={isPlayback}
      isReplay={isReplay}
      onGoToWorkspace={handleGoToWorkspace}
    />
  );
};

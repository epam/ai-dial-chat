import { IconSearch } from '@tabler/icons-react';
import { MouseEvent, useCallback, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';

import Link from 'next/link';

import classNames from 'classnames';

import { useFuseSearch } from '@/src/hooks/useFuseSearch';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getConversationModelParams,
  isPlaybackConversation,
  isReplayAsIsConversation,
  isReplayConversation,
} from '@/src/utils/app/conversation';
import { isSmallScreenOrTouchable } from '@/src/utils/app/mobile';
import { groupModelsAndSaveOrder } from '@/src/utils/app/models';
import { PseudoModel } from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { DialAIEntityModel } from '@/src/types/models';
import { CardType } from '@/src/types/talkTo';
import { Translation } from '@/src/types/translation';

import { ConversationsActions, ModelsActions } from '@/src/store/actions';
import { useAppSelector } from '@/src/store/hooks';
import {
  AddonsSelectors,
  ModelsSelectors,
  SettingsSelectors,
  WidgetsSelectors,
} from '@/src/store/selectors';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';
import {
  ChangeAgentTabs,
  MarketplaceQueryParams,
  MarketplaceTabs,
} from '@/src/constants/marketplace';
import { MODELS_SEARCH_OPTIONS } from '@/src/constants/search';
import { SuggestedCard } from '@/src/constants/talkTo';

import { TabButton } from '@/src/components/Buttons/TabButton';
import { AgentDialogs } from '@/src/components/Common/AgentDialogs';
import { Modal } from '@/src/components/Common/Modal';

import { TalkToSlider } from './TalkToSlider';

import { Feature } from '@epam/ai-dial-shared';
import orderBy from 'lodash-es/orderBy';

interface TabButtonProps {
  tab: MarketplaceTabs;
  setTab: (tab: MarketplaceTabs) => void;
  currentTab: MarketplaceTabs;
}

function AgentsTabButton({ tab, setTab, currentTab }: TabButtonProps) {
  const { t } = useTranslation(Translation.Marketplace);
  return (
    <TabButton selected={currentTab === tab} onClick={() => setTab(tab)}>
      {t(ChangeAgentTabs[tab])}
    </TabButton>
  );
}

interface TalkToModalViewProps {
  conversation: Conversation;
  isCompareMode: boolean;
  isRight: boolean;
  onClose: () => void;
}

const TalkToModalView = ({
  conversation,
  isCompareMode,
  isRight,
  onClose,
}: TalkToModalViewProps) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useDispatch();

  const [tab, setTab] = useState(MarketplaceTabs.MY_WORKSPACE);
  const isMyWorkspace = tab === MarketplaceTabs.MY_WORKSPACE;

  const isMarketplaceEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.Marketplace),
  );
  const allModels = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const addonsMap = useAppSelector(AddonsSelectors.selectAddonsMap);
  const installedModelIdsSet = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const recentModelIds = useAppSelector(ModelsSelectors.selectRecentModelsIds);
  const widgetsSchemaIds = useAppSelector(
    WidgetsSelectors.selectWidgetsSchemaIds,
  );

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  const [searchTerm, setSearchTerm] = useState('');

  const isPlayback = isPlaybackConversation(conversation);
  const isReplay = isReplayConversation(conversation);

  const searchedModels = useFuseSearch(
    allModels,
    searchTerm,
    MODELS_SEARCH_OPTIONS,
  );

  const sortedModels = useMemo(() => {
    if (!isMyWorkspace) {
      return searchedModels;
    }
    const currentModel = modelsMap[conversation.model.id];
    const recentInstalledModels = recentModelIds
      .filter((id) => installedModelIdsSet.has(id) && modelsMap[id])
      .map((id) => modelsMap[id]) as DialAIEntityModel[];
    const installedModels = searchedModels.filter(
      (model) =>
        installedModelIdsSet.has(model.reference) && modelsMap[model.reference],
    );
    return [
      ...(currentModel &&
      (installedModelIdsSet.has(currentModel.reference) || !isReplay)
        ? [currentModel]
        : []),
      ...recentInstalledModels,
      ...installedModels,
    ];
  }, [
    searchedModels,
    conversation.model.id,
    installedModelIdsSet,
    isMyWorkspace,
    isReplay,
    modelsMap,
    recentModelIds,
  ]);

  const displayedModels = useMemo(() => {
    const filteredModels = sortedModels.filter(
      (entity) =>
        !widgetsSchemaIds.has(entity.applicationTypeSchemaId as string),
    );
    const groupedModels = groupModelsAndSaveOrder(filteredModels);
    const orderedModels: CardType[] = groupedModels.map(({ entities }) => {
      const selectedEntity = entities.find(
        ({ reference }) => reference === conversation.model.id,
      );

      if (selectedEntity) {
        return selectedEntity;
      }

      return orderBy(entities, 'version', 'desc')[0];
    });

    if (isMyWorkspace) {
      if (isPlayback) {
        orderedModels.unshift({
          id: PseudoModel.Playback,
          name: t('Playback'),
          reference: PseudoModel.Playback,
          type: EntityType.Model,
          isDefault: false,
        });
      } else if (isReplay) {
        orderedModels.unshift({
          id: REPLAY_AS_IS_MODEL,
          name: t('Replay as is'),
          description: t(
            'This mode replicates user requests from the original conversation including settings set in each message.',
          ),
          reference: REPLAY_AS_IS_MODEL,
          type: EntityType.Model,
          isDefault: false,
        });
      } else if (!modelsMap[conversation.model.id]) {
        orderedModels.unshift({
          id: conversation.model.id,
          name: conversation.model.id,
          reference: conversation.model.id,
          description: t('chat.error.incorrect-selected', {
            context: EntityType.Model,
          }),
          type: EntityType.Model,
          isDefault: false,
        });
      }

      if (searchTerm.length > 0 && orderedModels.length > 0) {
        orderedModels.push(SuggestedCard);
      }
    }

    return orderedModels;
  }, [
    sortedModels,
    isPlayback,
    isReplay,
    modelsMap,
    conversation.model.id,
    searchTerm,
    isMyWorkspace,
    widgetsSchemaIds,
    t,
  ]);

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
                addonsMap,
              ),
            },
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
    [
      addonsMap,
      conversation,
      dispatch,
      installedModelIdsSet,
      modelsMap,
      onClose,
    ],
  );

  const handleGoToWorkspace = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (isPlayback) {
        e.preventDefault();
      } else {
        dispatch(ConversationsActions.setTalkToConversationId(null));
      }
    },
    [isPlayback, dispatch],
  );

  return (
    <>
      <h3 className="text-base font-semibold">
        {t(
          `Select an agent for ${isCompareMode ? (isRight ? 'right side' : 'left side') : ''} conversation`,
        )}
      </h3>
      <div className="relative my-4 flex w-full gap-2 max-sm:flex-col-reverse">
        <div className="relative flex grow">
          <IconSearch
            className="absolute left-3 top-1/2 -translate-y-1/2"
            size={18}
          />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('Search')}
            className="input-form peer m-0 pl-[38px]"
            data-qa="search-agents"
            autoFocus={isOverlay || !isSmallScreenOrTouchable()}
          />
        </div>
        <div className="flex gap-2">
          <AgentsTabButton
            tab={MarketplaceTabs.MY_WORKSPACE}
            setTab={setTab}
            currentTab={tab}
          />
          <AgentsTabButton
            tab={MarketplaceTabs.HOME}
            setTab={setTab}
            currentTab={tab}
          />
        </div>
      </div>

      <TalkToSlider
        conversation={conversation}
        items={displayedModels}
        onSelectModel={handleSelectModel}
        isMyWorkspace={isMyWorkspace}
        onOpenMarketplaceTab={() => setTab(MarketplaceTabs.HOME)}
        isSearchMode={searchTerm.length > 0}
        searchTerm={searchTerm}
      />

      {isMarketplaceEnabled && (
        <Link
          href={`/marketplace?${MarketplaceQueryParams.fromConversation}=${encodeURIComponent(conversation.id)}${isMyWorkspace ? `&${MarketplaceQueryParams.tab}=${tab}` : ''}`}
          shallow
          onClick={handleGoToWorkspace}
          className={classNames(
            'm-auto mt-4 text-accent-primary md:absolute md:bottom-6 md:right-6',
            isPlayback && 'cursor-not-allowed',
          )}
          data-qa="go-to-my-workspace"
        >
          {t(`Go to ${isMyWorkspace ? 'My workspace' : 'DIAL Marketplace'}`)}
        </Link>
      )}

      <AgentDialogs />
    </>
  );
};

interface Props {
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
}: Props) => {
  return (
    <Modal
      portalId="theme-main"
      state={ModalState.OPENED}
      dataQa="talk-to-agent"
      containerClassName="flex xl:h-fit relative max-h-full flex-col rounded py-4 px-3 md:p-6 w-full grow items-start justify-center !bg-layer-2 md:w-[728px] md:max-w-[728px] xl:w-[1200px] xl:max-w-[1200px]"
      onClose={onClose}
    >
      <TalkToModalView
        isCompareMode={isCompareMode}
        isRight={isRight}
        conversation={conversation}
        onClose={onClose}
      />
    </Modal>
  );
};

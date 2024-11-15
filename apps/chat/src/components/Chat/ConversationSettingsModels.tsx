import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import { getValidEntitiesFromIds } from '@/src/utils/app/conversation';
import { ApiUtils } from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { RECENT_MODELS_COUNT, REPLAY_AS_IS_MODEL } from '@/src/constants/chat';
import { MarketplaceQueryParams } from '@/src/constants/marketplace';

import { ModelIcon } from '../Chatbar/ModelIcon';
import { EntityMarkdownDescription } from '../Common/MarkdownDescription';
import { ModelList } from './ModelList';
import { PlaybackModelButton } from './Playback/PlaybackModelButton';
import { ReplayAsIsButton } from './ReplayAsIsButton';

import { Feature } from '@epam/ai-dial-shared';

interface Props {
  modelId: string | undefined;
  conversation: Conversation;
  onModelSelect: (modelId: string) => void;
  isModelUnavailable?: boolean;
}

export const ConversationSettingsModel = ({
  modelId,
  conversation,
  onModelSelect,
  isModelUnavailable,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const router = useRouter();

  const dispatch = useAppDispatch();

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const recentModelsIds = useAppSelector(
    ModelsSelectors.selectRecentWithInstalledModelsIds,
  );
  const models = useAppSelector(ModelsSelectors.selectModels);

  const isPlayback = conversation.playback?.isPlayback;
  const isReplay = conversation.replay?.isReplay;
  const [isReplayAsIs, setIsReplayAsIs] = useState(
    conversation.replay?.replayAsIs ?? false,
  );

  const isMarketplaceEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.Marketplace),
  );

  useEffect(() => {
    setIsReplayAsIs(conversation.replay?.replayAsIs ?? false);
  }, [conversation.replay?.replayAsIs]);

  const entities = useMemo(() => {
    return getValidEntitiesFromIds(
      modelId &&
        !isModelUnavailable &&
        !recentModelsIds.slice(0, RECENT_MODELS_COUNT).includes(modelId)
        ? [modelId, ...recentModelsIds]
        : recentModelsIds,
      modelsMap,
    );
  }, [modelId, modelsMap, recentModelsIds, isModelUnavailable]);

  const handleModelSelect = useCallback(
    (entityId: string, rearrange?: boolean) => {
      setIsReplayAsIs(entityId === REPLAY_AS_IS_MODEL);
      onModelSelect(entityId);
      if (entityId !== REPLAY_AS_IS_MODEL) {
        dispatch(
          ModelsActions.updateRecentModels({
            modelId: entityId,
            rearrange,
          }),
        );
      }
    },
    [dispatch, onModelSelect],
  );

  return (
    <div className="w-full" data-qa="entity-selector">
      <div className="mb-4">{t('Talk to')}</div>

      <div className="flex flex-col gap-3" data-qa="recent">
        <div className="grid grid-cols-1 gap-3">
          {isPlayback && <PlaybackModelButton />}
          {isReplay && conversation.replay && (
            <ReplayAsIsButton
              selected={isReplayAsIs}
              onSelect={handleModelSelect}
            />
          )}
          {!isPlayback && !isReplay && isModelUnavailable && (
            <button className="flex items-center gap-3 rounded border border-accent-primary p-3 text-left text-xs">
              <ModelIcon entityId="" entity={undefined} size={24} />
              <div className="flex flex-col gap-1">
                <span className="text-secondary" data-qa="talk-to-entity-name">
                  {modelId}
                </span>
                <span className="text-error" data-qa="talk-to-entity-descr">
                  <EntityMarkdownDescription isShortDescription>
                    {t('chat.error.incorrect-selected', {
                      context: EntityType.Model,
                    })}
                  </EntityMarkdownDescription>
                </span>
              </div>
            </button>
          )}
          <ModelList
            entities={entities}
            onSelect={handleModelSelect}
            selectedModelId={modelId}
            showInOneColumn
            displayCountLimit={
              isReplay || isPlayback || isModelUnavailable
                ? RECENT_MODELS_COUNT - 1
                : RECENT_MODELS_COUNT
            }
            disabled={isPlayback}
            notAllowExpandDescription
            allEntities={models}
            isReplayAsIs={isReplayAsIs}
          />
        </div>
      </div>
      {isMarketplaceEnabled && (
        <button
          disabled={isPlayback}
          className="mt-3 inline text-left text-accent-primary disabled:cursor-not-allowed"
          onClick={() =>
            router.push(
              `/marketplace?${MarketplaceQueryParams.fromConversation}=${ApiUtils.encodeApiUrl(conversation.id)}`,
            )
          }
          data-qa="search-on-my-app"
        >
          {t('Search on My workspace')}
        </button>
      )}
    </div>
  );
};

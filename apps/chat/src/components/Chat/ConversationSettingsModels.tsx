import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { getValidEntitiesFromIds } from '@/src/utils/app/conversation';

import { Conversation } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';

import {
  RECENT_MODELS_COUNT,
  REPLAY_AS_IS_MODEL,
  TALK_TO_TOOLTIP,
} from '@/src/constants/chat';

import { TooltipContainer } from '@/src/components/Common/TooltipContainer';

import { ModelIcon } from '../Chatbar/ModelIcon';
import { EntityMarkdownDescription } from '../Common/MarkdownDescription';
import { ModelList } from './ModelList';
import { ModelsDialog } from './ModelsDialog';
import { PlaybackModelButton } from './Playback/PlaybackModelButton';
import { ReplayAsIsButton } from './ReplayAsIsButton';

interface Props {
  modelId: string | undefined;
  conversation: Conversation;
  onModelSelect: (modelId: string) => void;
  unavailableModelId?: string;
}

export const ConversationSettingsModel = ({
  modelId,
  conversation,
  onModelSelect,
  unavailableModelId,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const recentModelsIds = useAppSelector(ModelsSelectors.selectRecentModelsIds);
  const models = useAppSelector(ModelsSelectors.selectModels);
  const [isModelsDialogOpen, setIsModelsDialogOpen] = useState(false);

  const isPlayback = conversation.playback?.isPlayback;
  const isReplay = conversation.replay?.isReplay;
  const [isReplayAsIs, setIsReplayAsIs] = useState(
    conversation.replay?.replayAsIs ?? false,
  );

  useEffect(() => {
    setIsReplayAsIs(conversation.replay?.replayAsIs ?? false);
  }, [conversation.replay?.replayAsIs]);

  const enitities = useMemo(() => {
    return getValidEntitiesFromIds(
      modelId &&
        modelId !== unavailableModelId &&
        !recentModelsIds.includes(modelId)
        ? [modelId, ...recentModelsIds]
        : recentModelsIds,
      modelsMap,
    );
  }, [modelId, modelsMap, recentModelsIds, unavailableModelId]);

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
      <div className="mb-4 flex items-center gap-2 font-medium">
        <div>{t('chat.common.start_discussion_with.label')}</div>
        <TooltipContainer
          description={t(TALK_TO_TOOLTIP, { ns: Translation.Common })}
        />
      </div>

      <div className="flex flex-col gap-3" data-qa="recent">
        <div className="grid grid-cols-1 gap-3">
          {isPlayback && <PlaybackModelButton />}
          {isReplay && conversation.replay && (
            <ReplayAsIsButton
              selected={isReplayAsIs}
              onSelect={handleModelSelect}
            />
          )}
          {!isPlayback && !isReplay && unavailableModelId && (
            <button className="flex items-center gap-3 rounded border border-accent-primary p-3 text-left text-xs">
              <ModelIcon
                entityId=""
                entity={undefined}
                size={24}
                isSmallIconSize={false}
              />
              <div className="flex flex-col gap-1">
                <span
                  className="text-secondary-bg-light"
                  data-qa="group-entity-name"
                >
                  {unavailableModelId}
                </span>
                <span className="text-error" data-qa="group-entity-descr">
                  <EntityMarkdownDescription isShortDescription>
                    {t('chat.error.incorrect_selected_model.text')}
                  </EntityMarkdownDescription>
                </span>
              </div>
            </button>
          )}
          <ModelList
            entities={enitities}
            onSelect={handleModelSelect}
            selectedModelId={modelId}
            showInOneColumn
            displayCountLimit={
              isReplay || isPlayback || unavailableModelId
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
      <button
        disabled={isPlayback}
        className="mt-3 inline text-left text-quaternary-bg-light hover:text-primary-bg-light disabled:cursor-not-allowed"
        onClick={() => setIsModelsDialogOpen(true)}
        data-qa="see-full-list"
      >
        {t('chat.common.button.see_full_list.label')}
      </button>
      <ModelsDialog
        selectedModelId={modelId}
        isOpen={isModelsDialogOpen}
        onModelSelect={handleModelSelect}
        onClose={() => setIsModelsDialogOpen(false)}
      />
    </div>
  );
};

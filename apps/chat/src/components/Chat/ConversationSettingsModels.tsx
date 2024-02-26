import { useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { getValidEntitiesFromIds } from '@/src/utils/app/conversation';

import { Conversation } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';

import { RECENT_MODELS_COUNT } from '@/src/constants/chat';

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

  const enitities = useMemo(() => {
    const recentModels = getValidEntitiesFromIds(recentModelsIds, modelsMap);
    const nameSet = new Set(recentModels.map((m) => m.name));

    return recentModels.concat(models.filter((m) => nameSet.has(m.name)));
  }, [models, modelsMap, recentModelsIds]);

  const handleModelSelect = useCallback(
    (entityId: string, rearrange?: boolean) => {
      onModelSelect(entityId);
      dispatch(
        ModelsActions.updateRecentModels({
          modelId: entityId,
          rearrange,
        }),
      );
    },
    [dispatch, onModelSelect],
  );

  const playbackModelID =
    conversation.playback?.messagesStack[
      conversation.playback.activePlaybackIndex
    ]?.model?.id ?? conversation.model.id;

  const playbackModelName = modelsMap[playbackModelID]?.name || playbackModelID;

  const isPlayback = conversation.playback?.isPlayback;
  const isReplay = conversation.replay.isReplay;

  return (
    <div className="w-full" data-qa="entity-selector">
      <div className="mb-4">{t('Talk to')}</div>

      <div className="flex flex-col gap-3" data-qa="recent">
        <div className="grid grid-cols-1 gap-3">
          {isPlayback && <PlaybackModelButton modelName={playbackModelName} />}
          {isReplay && (
            <ReplayAsIsButton
              replay={conversation.replay}
              conversationId={conversation.id}
            />
          )}
          {unavailableModelId && (
            <button className="flex items-center gap-3 rounded border border-accent-primary p-3 text-left text-xs">
              <ModelIcon entityId="" entity={undefined} size={24} />
              <div className="flex flex-col gap-1">
                <span className="text-secondary" data-qa="group-entity-name">
                  {unavailableModelId}
                </span>
                <span className="text-error" data-qa="group-entity-descr">
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
          />
        </div>
      </div>
      <button
        disabled={isPlayback}
        className="mt-3 inline text-left text-accent-primary disabled:cursor-not-allowed"
        onClick={() => setIsModelsDialogOpen(true)}
        data-qa="see-full-list"
      >
        {t('See full list...')}
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

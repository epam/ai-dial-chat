import { useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getValidEntitiesFromIds } from '@/src/utils/app/conversation';

import { Conversation } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { OpenAIEntityModel } from '@/src/types/openai';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { ModelIcon } from '../Chatbar/ModelIcon';
import { EntityMarkdownDescription } from '../Common/MarkdownDescription';
import { ModelsDialog } from './ModelsDialog';
import { PlaybackModelButton } from './Playback/PlaybackModelButton';
import { ReplayAsIsButton } from './ReplayAsIsButton';

interface Props {
  modelId: string | undefined;
  conversation: Conversation;
  onModelSelect: (modelId: string) => void;
  unavailableModelId?: string;
}

const RECENT_MODELS_COUNT = 5;

export const ConversationSettingsModel = ({
  modelId,
  conversation,
  onModelSelect,
  unavailableModelId,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const recentModelsIds = useAppSelector(ModelsSelectors.selectRecentModelsIds);
  const [mappedEntities, setMappedEntities] = useState<OpenAIEntityModel[]>([]);
  const [isModelsDialogOpen, setIsModelsDialogOpen] = useState(false);

  useEffect(() => {
    const mappedEntities = getValidEntitiesFromIds(
      recentModelsIds,
      modelsMap,
    ).slice(
      0,
      unavailableModelId ? RECENT_MODELS_COUNT - 1 : RECENT_MODELS_COUNT,
    );
    setMappedEntities(mappedEntities);
  }, [recentModelsIds, modelsMap, unavailableModelId]);

  const playbackModelID =
    conversation.playback?.messagesStack[
      conversation.playback.activePlaybackIndex
    ]?.model?.id ?? conversation.model.id;

  const playbackModelName = modelsMap[playbackModelID]?.name;

  const isPlayback = conversation.playback?.isPlayback;

  return (
    <div className="w-full" data-qa="entity-selector">
      <div className="mb-4">{t('Talk to')}</div>

      <div className="flex flex-col gap-3" data-qa="recent">
        <div className="grid grid-cols-1 gap-3">
          {conversation.playback?.isPlayback && (
            <PlaybackModelButton modelName={playbackModelName} />
          )}
          {conversation.replay.isReplay && (
            <ReplayAsIsButton
              replay={conversation.replay}
              conversationId={conversation.id}
            />
          )}
          {unavailableModelId && (
            <button className="flex items-center gap-3 rounded border border-accent-primary p-3 text-left text-xs">
              <ModelIcon entityId="" entity={undefined} size={24} />
              <div className="flex flex-col gap-1">
                <span className="text-secondary" data-qa="entity-name">
                  {unavailableModelId}
                </span>
                <span className="text-error" data-qa="entity-descr">
                  <EntityMarkdownDescription isShortDescription>
                    {t('chat.error.incorrect-selected', {
                      context: EntityType.Model,
                    })}
                  </EntityMarkdownDescription>
                </span>
              </div>
            </button>
          )}
          {mappedEntities.map((entity) => (
            <button
              className={classNames(
                'flex items-center gap-3 rounded border p-3 text-left text-xs disabled:cursor-not-allowed',
                modelId === entity.id &&
                  !conversation.replay.replayAsIs &&
                  !isPlayback
                  ? 'border-accent-primary'
                  : 'border-primary hover:border-hover',
              )}
              key={entity.id}
              onClick={() => onModelSelect(entity.id)}
              disabled={isPlayback}
            >
              <ModelIcon entityId={entity.id} entity={entity} size={24} />
              <div className="flex flex-col gap-1">
                <span data-qa="entity-name">{entity.name}</span>
                {entity.description && (
                  <span className="text-secondary" data-qa="entity-descr">
                    <EntityMarkdownDescription isShortDescription>
                      {entity.description}
                    </EntityMarkdownDescription>
                  </span>
                )}
              </div>
            </button>
          ))}
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
        onModelSelect={onModelSelect}
        onClose={() => setIsModelsDialogOpen(false)}
      />
    </div>
  );
};

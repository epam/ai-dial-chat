import { useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { Replay } from '@/src/types/chat';
import { OpenAIEntityModel } from '@/src/types/openai';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import { EntityMarkdownDescription } from '../Common/MarkdownDescription';
import { ModelsDialog } from './ModelsDialog';
import { ReplayAsIsButton } from './ReplayAsIsButton';

interface Props {
  modelId: string | undefined;
  conversationId: string;
  replay: Replay;
  onModelSelect: (modelId: string) => void;
}

export const ConversationSettingsModel = ({
  modelId,
  replay,
  conversationId,
  onModelSelect,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const recentModelsIds = useAppSelector(ModelsSelectors.selectRecentModelsIds);
  const theme = useAppSelector(UISelectors.selectThemeState);
  const [mappedEntities, setMappedEntities] = useState<OpenAIEntityModel[]>([]);
  const [isModelsDialogOpen, setIsModelsDialogOpen] = useState(false);

  useEffect(() => {
    const mappedEntities = (
      Array.from(recentModelsIds)
        .map((id) => modelsMap[id])
        .filter(Boolean) as OpenAIEntityModel[]
    ).slice(0, 5);
    setMappedEntities(mappedEntities);
  }, [recentModelsIds, modelsMap]);

  return (
    <div className="w-full" data-qa="entity-selector">
      <div className="mb-4">{t('Talk to')}</div>

      <div className="flex flex-col gap-3" data-qa="recent">
        <div className="grid grid-cols-1 gap-3">
          {replay.isReplay && (
            <ReplayAsIsButton replay={replay} conversationId={conversationId} />
          )}
          {mappedEntities.map((entity) => (
            <button
              className={`flex items-center gap-3 rounded border p-3 text-left text-xs ${
                modelId === entity.id && !replay.replayAsIs
                  ? 'border-blue-500'
                  : 'hover:border-controls-hover border-primary'
              }`}
              key={entity.id}
              onClick={() => onModelSelect(entity.id)}
            >
              <ModelIcon
                entityId={entity.id}
                entity={entity}
                size={24}
                inverted={theme === 'dark'}
              />
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
        className="text-blue-500 mt-3 inline text-left"
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

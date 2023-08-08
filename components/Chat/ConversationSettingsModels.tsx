import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { OpenAIEntityModel } from '@/types/openai';

import HomeContext from '@/pages/api/home/home.context';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import { MemoizedReactMarkdown } from '../Markdown/MemoizedReactMarkdown';
import { ModelsDialog } from './ModelsDialog';

import remarkGfm from 'remark-gfm';

interface Props {
  modelId: string;
  onModelSelect: (modelId: string) => void;
}

export const ConversationSettingsModel = ({
  modelId,
  onModelSelect,
}: Props) => {
  const { t } = useTranslation();
  const {
    state: { modelsMap, recentModelsIds, lightMode },
  } = useContext(HomeContext);
  const [recentModels, setRecentModels] = useState<OpenAIEntityModel[]>([]);
  const [recentNonModels, setRecentNonModels] = useState<OpenAIEntityModel[]>(
    [],
  );
  const [isModelsDialogOpen, setIsModelDialogOpen] = useState(false);

  useEffect(() => {
    const mappedEntities = Array.from(recentModelsIds)
      .map((id) => modelsMap[id])
      .filter(Boolean);
    setRecentModels(
      mappedEntities.filter((entity) => entity.type === 'model').slice(0, 4),
    );
    setRecentNonModels(
      mappedEntities.filter((entity) => entity.type !== 'model').slice(0, 3),
    );
  }, [recentModelsIds]);

  return (
    <div>
      <div className="mb-4">{t('Talk to')}</div>

      <div className="flex flex-col gap-3">
        <div className="text-gray-500">{t('Recent')}</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {recentModels.map((entity) => (
            <button
              className={`flex items-center gap-3 rounded border p-3 text-left text-xs ${
                modelId === entity.id
                  ? 'border-blue-500'
                  : 'border-gray-400 hover:border-gray-800 dark:border-gray-600 hover:dark:border-gray-200'
              }`}
              key={entity.id}
              onClick={() => onModelSelect(entity.id)}
            >
              <ModelIcon
                entityId={entity.id}
                entity={entity}
                size={24}
                inverted={lightMode === 'dark'}
              />
              {entity.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3">
          {recentNonModels.map((entity) => (
            <button
              className={`flex items-center gap-3 rounded border p-3 text-left text-xs ${
                modelId === entity.id
                  ? 'border-blue-500'
                  : 'border-gray-400 hover:border-gray-800 dark:border-gray-600 hover:dark:border-gray-200'
              }`}
              key={entity.id}
              onClick={() => onModelSelect(entity.id)}
            >
              <ModelIcon
                entityId={entity.id}
                entity={entity}
                size={24}
                inverted={lightMode === 'dark'}
              />
              <div className="flex flex-col gap-1">
                <span>{entity.name}</span>
                {entity.description && (
                  <span className="text-gray-500">
                    <MemoizedReactMarkdown remarkPlugins={[remarkGfm]}>
                      {entity.description}
                    </MemoizedReactMarkdown>
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
      <button
        className="mt-3 inline text-left text-blue-500"
        onClick={() => setIsModelDialogOpen(true)}
      >
        {t('See full list...')}
      </button>
      <ModelsDialog
        selectedModelId={modelId}
        isOpen={isModelsDialogOpen}
        onModelSelect={onModelSelect}
        onClose={() => setIsModelDialogOpen(false)}
      />
    </div>
  );
};

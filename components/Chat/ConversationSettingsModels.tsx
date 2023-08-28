import { useContext, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { OpenAIEntityModel } from '@/types/openai';

import { useAppSelector } from '@/store/hooks';
import {
  selectModelsMap,
  selectRecentModelsIds,
} from '@/store/models/models.reducers';

import HomeContext from '@/pages/api/home/home.context';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import { EntityMarkdownDescription } from '../Common/MarkdownDescription';
import { ModelsDialog } from './ModelsDialog';

interface Props {
  modelId: string | undefined;
  onModelSelect: (modelId: string) => void;
}

export const ConversationSettingsModel = ({
  modelId,
  onModelSelect,
}: Props) => {
  const { t } = useTranslation();
  const {
    state: { lightMode },
  } = useContext(HomeContext);
  const modelsMap = useAppSelector(selectModelsMap);
  const recentModelsIds = useAppSelector(selectRecentModelsIds);
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
          {mappedEntities.map((entity) => (
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
                    <EntityMarkdownDescription isShortDescription={true}>
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
        className="mt-3 inline text-left text-blue-500"
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

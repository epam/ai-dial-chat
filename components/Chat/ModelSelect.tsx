import { IconExclamationCircle, IconExternalLink } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { OpenAIEntityModel, OpenAIEntityModelID } from '@/types/openai';

interface Props {
  models: OpenAIEntityModel[];
  conversationModelId: string;
  conversationModelName: string;
  defaultModelId: OpenAIEntityModelID;
  onSelectModel: (modelId: string) => void;
}

export const ModelSelect = ({
  conversationModelId,
  conversationModelName,
  models,
  defaultModelId,
  onSelectModel,
}: Props) => {
  const { t } = useTranslation('chat');

  const [isNotAllowedModelSelected, setIsNotAllowedModelSelected] =
    useState(false);

  useEffect(() => {
    const modelsIds = models.map(({ id }) => id);
    setIsNotAllowedModelSelected(!modelsIds.includes(conversationModelId));
  }, [conversationModelId, models]);

  return (
    <div className="flex flex-col">
      <label className="mb-2 text-left text-neutral-700 dark:text-neutral-400">
        {t('Model')}
      </label>
      <div className="w-full rounded-lg border border-neutral-200 bg-transparent pr-2 text-neutral-900 dark:border-neutral-600 dark:text-white">
        <select
          className="w-full bg-transparent p-2"
          placeholder={t('Select a model') || ''}
          value={conversationModelId || defaultModelId}
          onChange={(e) => onSelectModel(e.target.value)}
        >
          {isNotAllowedModelSelected && (
            <option
              key={conversationModelId}
              value={conversationModelId}
              className="dark:bg-[#343541] dark:text-white"
              disabled={true}
            >
              {conversationModelName}
            </option>
          )}
          {models.map((model) => (
            <option
              key={model.id}
              value={model.id}
              className="dark:bg-[#343541] dark:text-white"
            >
              {model.id === defaultModelId
                ? `Default (${model.name})`
                : model.name}
            </option>
          ))}
        </select>
      </div>
      {conversationModelId === OpenAIEntityModelID.GPT_4_32K && (
        <div className="w-full mt-3 text-left text-orange-600 dark:text-orange-600 flex gap-2 items-center">
          <IconExclamationCircle size={18} />
          <div>
            Please only use this one if you absolutely need it. It&apos;s slower
            and more expensive.
          </div>
        </div>
      )}
    </div>
  );
};

import { IconExclamationCircle, IconExternalLink } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import { OpenAIModel, OpenAIModelID } from '@/types/openai';

interface Props {
  models: OpenAIModel[];
  conversationModelId: string;
  defaultModelId: OpenAIModelID;
  onSelectModel: (modelId: string) => void;
}

export const ModelSelect = ({
  conversationModelId,
  models,
  defaultModelId,
  onSelectModel,
}: Props) => {
  const { t } = useTranslation('chat');

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
      {conversationModelId === OpenAIModelID.GPT_4_32K && (
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

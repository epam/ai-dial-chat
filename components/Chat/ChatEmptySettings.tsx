import { useEffect } from 'react';

import { useTranslation } from 'next-i18next';

import { Conversation } from '@/types/chat';
import { OpenAIModel, OpenAIModelID } from '@/types/openai';
import { Prompt } from '@/types/prompt';

import { ModelSelect } from './ModelSelect';
import { SystemPrompt } from './SystemPrompt';
import { TemperatureSlider } from './Temperature';

interface Props {
  conversation: Conversation;
  prompts: Prompt[];
  models: OpenAIModel[];
  defaultModelId: OpenAIModelID;
  onChangePrompt: (prompt: string) => void;
  onChangeTemperature: (temperature: number) => void;
  onSelectModel: (modelId: string) => void;
}

export const ChatEmptySettings = ({
  conversation,
  prompts,
  models,
  defaultModelId,
  onChangePrompt,
  onChangeTemperature,
  onSelectModel,
}: Props) => {
  const { t } = useTranslation('chat');

  return (
    <div className="flex h-full flex-col space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-600">
      <ModelSelect
        conversationModelId={conversation.model.id}
        conversationModelName={conversation.model.name}
        defaultModelId={defaultModelId}
        models={models}
        onSelectModel={onSelectModel}
      />

      <SystemPrompt
        conversation={conversation}
        prompts={prompts}
        onChangePrompt={onChangePrompt}
      />

      <TemperatureSlider
        label={t('Temperature')}
        onChangeTemperature={onChangeTemperature}
      />
    </div>
  );
};

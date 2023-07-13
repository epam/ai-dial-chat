import { useTranslation } from 'next-i18next';

import { Conversation } from '@/types/chat';
import {
  OpenAIEntityModel,
  OpenAIEntityModelID,
  OpenAIEntityModels,
} from '@/types/openai';
import { Prompt } from '@/types/prompt';

import { ModelSelect } from './ModelSelect';
import { SystemPrompt } from './SystemPrompt';
import { TemperatureSlider } from './Temperature';

interface Props {
  conversation: Conversation;
  prompts: Prompt[];
  models: OpenAIEntityModel[];
  defaultModelId: OpenAIEntityModelID;
  onChangePrompt: (prompt: string) => void;
  onChangeTemperature: (temperature: number) => void;
  onSelectModel: (modelId: string) => void;
  onSelectAssistantSubModel: (modelId: string) => void;
}

export const ChatEmptySettings = ({
  conversation,
  prompts,
  models,
  defaultModelId,
  onChangePrompt,
  onChangeTemperature,
  onSelectModel,
  onSelectAssistantSubModel,
}: Props) => {
  const { t } = useTranslation('chat');
  const aiEntityType = conversation.model.type;
  const modelsFiltered = models.filter((etity) => etity.type === 'model');
  const defaultAssitantSubModel = OpenAIEntityModels[OpenAIEntityModelID.GPT_4];
  const assitantSubModelName = conversation.assistantModelId
    ? OpenAIEntityModels[conversation.assistantModelId as OpenAIEntityModelID]
        .name
    : defaultAssitantSubModel.name;
  return (
    <div className="flex h-full flex-col space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-600">
      <ModelSelect
        conversationModelId={conversation.model.id}
        conversationModelName={conversation.model.name}
        defaultModelId={defaultModelId}
        models={models}
        onSelectModel={onSelectModel}
      />
      {aiEntityType === 'assistant' && (
        <ModelSelect
          conversationModelId={
            conversation.assistantModelId ?? defaultAssitantSubModel.id
          }
          conversationModelName={
            assitantSubModelName ?? defaultAssitantSubModel.name
          }
          label="Model"
          defaultModelId={defaultModelId}
          models={modelsFiltered}
          onSelectModel={onSelectAssistantSubModel}
        />
      )}
      {aiEntityType === 'model' && (
        <SystemPrompt
          conversation={conversation}
          prompts={prompts}
          onChangePrompt={onChangePrompt}
        />
      )}

      {aiEntityType !== 'application' && (
        <TemperatureSlider
          label={t('Temperature')}
          onChangeTemperature={onChangeTemperature}
          conversation={conversation}
        />
      )}
    </div>
  );
};

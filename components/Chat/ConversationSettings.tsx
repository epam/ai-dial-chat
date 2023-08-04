import { useTranslation } from 'next-i18next';

import { DEFAULT_ASSISTANT_SUBMODEL } from '@/utils/app/const';

import { Conversation } from '@/types/chat';
import {
  OpenAIEntityAddon,
  OpenAIEntityAddonID,
  OpenAIEntityModel,
  OpenAIEntityModelID,
  OpenAIEntityModels,
} from '@/types/openai';
import { Prompt } from '@/types/prompt';

import { Addons } from './Addons';
import { ModelSelect } from './ModelSelect';
import { SystemPrompt } from './SystemPrompt';
import { TemperatureSlider } from './Temperature';

interface Props {
  conversation: Conversation;
  prompts: Prompt[];
  models: OpenAIEntityModel[];
  defaultModelId: OpenAIEntityModelID;
  addons: OpenAIEntityAddon[];
  onChangeAddon: (addonId: string) => void;
  onChangePrompt: (prompt: string) => void;
  onChangeTemperature: (temperature: number) => void;
  onSelectModel: (modelId: string) => void;
  onSelectAssistantSubModel: (modelId: string) => void;
}

export const ConversationSettings = ({
  conversation,
  prompts,
  models,
  addons,
  defaultModelId,
  onChangePrompt,
  onChangeTemperature,
  onSelectModel,
  onSelectAssistantSubModel,
  onChangeAddon,
}: Props) => {
  const { t } = useTranslation('chat');
  const aiEntityType = conversation.model.type;
  const modelsFiltered = models.filter((etity) => etity.type === 'model');
  const assitantSubModelName =
    conversation.assistantModelId &&
    OpenAIEntityModels[conversation.assistantModelId as OpenAIEntityModelID]
      ? OpenAIEntityModels[conversation.assistantModelId as OpenAIEntityModelID]
          .name
      : DEFAULT_ASSISTANT_SUBMODEL.name;

  const model = models.find(({ id }) => id === conversation.model.id);
  const preselectedAddons =
    (model?.selectedAddons as OpenAIEntityAddonID[]) ?? [];

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
            conversation.assistantModelId ?? DEFAULT_ASSISTANT_SUBMODEL.id
          }
          conversationModelName={
            assitantSubModelName ?? DEFAULT_ASSISTANT_SUBMODEL.name
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

      {aiEntityType !== 'application' && (
        <Addons
          addons={addons}
          selectedAddons={conversation.selectedAddons}
          preselectedAddons={preselectedAddons ?? []}
          onChangeAddon={onChangeAddon}
        />
      )}
    </div>
  );
};

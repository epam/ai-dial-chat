import { useContext, useEffect, useState } from 'react';

import { DEFAULT_ASSISTANT_SUBMODEL } from '@/utils/app/const';

import { Conversation } from '@/types/chat';
import {
  OpenAIEntityAddon,
  OpenAIEntityModel,
  OpenAIEntityModelID,
} from '@/types/openai';
import { Prompt } from '@/types/prompt';

import HomeContext from '@/pages/api/home/home.context';

// import { Addons } from './Addons';
import { ConversationSettingsModel } from './ConversationSettingsModels';
import { ModelSelect } from './ModelSelect';

// import { SystemPrompt } from './SystemPrompt';
// import { TemperatureSlider } from './Temperature';

interface Props {
  conversation: Conversation;
  model: OpenAIEntityModel | undefined;
  prompts: Prompt[];
  defaultModelId: OpenAIEntityModelID;
  addons: OpenAIEntityAddon[];
  onChangeAddon: (addonId: string) => void;
  onChangePrompt: (prompt: string) => void;
  onChangeTemperature: (temperature: number) => void;
  onSelectModel: (modelId: string) => void;
  onSelectAssistantSubModel: (modelId: string) => void;
}

export const ConversationSettings = ({
  model,
  conversation,
  defaultModelId,
  onSelectModel,
  onSelectAssistantSubModel,
}: Props) => {
  const {
    state: { modelsMap, models },
  } = useContext(HomeContext);
  const [assistantSubModel, setAssistantSubModel] = useState(() => {
    return modelsMap[
      conversation.assistantModelId ?? DEFAULT_ASSISTANT_SUBMODEL.id
    ];
  });

  useEffect(() => {
    setAssistantSubModel(
      modelsMap[conversation.assistantModelId ?? DEFAULT_ASSISTANT_SUBMODEL.id],
    );
  }, [conversation.assistantModelId, modelsMap]);

  return (
    <div className="grid max-h-[500px] w-full min-w-[50%] grid-cols-1 gap-[1px] md:grid-cols-2" data-qa="conversation-settings">
      <div className="bg-gray-200 px-5 py-4 dark:bg-gray-800">
        <ConversationSettingsModel
          modelId={conversation.model.id}
          onModelSelect={onSelectModel}
        />
      </div>
      <div>
        {model && model.type === 'assistant' && assistantSubModel && (
          <div className="bg-gray-200 px-5 py-4 dark:bg-gray-800">
            <ModelSelect
              conversationModelId={assistantSubModel.id}
              conversationModelName={assistantSubModel.name}
              label="Model"
              defaultModelId={defaultModelId}
              models={models.filter((model) => model.type === 'model')}
              onSelectModel={onSelectAssistantSubModel}
            />
          </div>
        )}
        {/* {aiEntityType === 'model' && (
            <SystemPrompt
              conversation={conversation}
              prompts={prompts}
              onChangePrompt={onChangePrompt}
            />
          )} */}

        {/* {aiEntityType !== 'application' && (
            <TemperatureSlider
              label={t('Temperature')}
              onChangeTemperature={onChangeTemperature}
              conversation={conversation}
            />
          )} */}

        {/* {aiEntityType !== 'application' && (
            <Addons
              addons={addons}
              selectedAddons={conversation.selectedAddons}
              preselectedAddons={preselectedAddons ?? []}
              onChangeAddon={onChangeAddon}
            />
          )} */}
      </div>
    </div>
  );
};

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

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import { Combobox } from '../Common/Combobox';
// import { Addons } from './Addons';
import { ConversationSettingsModel } from './ConversationSettingsModels';

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
  onSelectModel,
  onSelectAssistantSubModel,
}: Props) => {
  const {
    state: { modelsMap, models, lightMode },
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

  const getModelSelectRow = () => {
    const ModelSelectRow = (model: OpenAIEntityModel) => {
      return (
        <div className="flex items-center gap-2">
          <ModelIcon
            entity={model}
            entityId={model.id}
            size={18}
            inverted={lightMode === 'dark'}
          />
          <span>{model.name || model.id}</span>
        </div>
      );
    };

    return ModelSelectRow;
  };

  return (
    <div className="grid max-h-[500px] w-full min-w-[50%] grid-cols-1 gap-[1px] overflow-auto md:grid-cols-2">
      <div className="bg-gray-200 px-5 py-4 dark:bg-gray-800">
        <ConversationSettingsModel
          modelId={conversation.model.id}
          onModelSelect={onSelectModel}
        />
      </div>
      <div>
        {model && model.type === 'assistant' && assistantSubModel && (
          <div className="bg-gray-200 px-5 py-4 dark:bg-gray-800">
            <Combobox
              label="Model"
              items={models.filter((model) => model.type === 'model')}
              initialSelectedItem={assistantSubModel}
              getItemLabel={(model: OpenAIEntityModel) =>
                model.name || model.id
              }
              getItemValue={(model: OpenAIEntityModel) => model.id}
              itemRow={getModelSelectRow()}
              onSelectItem={(itemID: string) => {
                onSelectAssistantSubModel(itemID);
              }}
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

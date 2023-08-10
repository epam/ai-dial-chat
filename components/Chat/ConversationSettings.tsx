import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
import { Addons } from './Addons';
import { ConversationSettingsModel } from './ConversationSettingsModels';
import { SystemPrompt } from './SystemPrompt';
import { TemperatureSlider } from './Temperature';

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
  prompts,
  onSelectModel,
  onSelectAssistantSubModel,
  onChangePrompt,
  onChangeTemperature,
  onChangeAddon,
}: Props) => {
  const {
    state: { modelsMap, models, lightMode },
    handleUpdateConversation,
  } = useContext(HomeContext);
  const { t } = useTranslation('chat');
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
    <div className="grid w-full min-w-[50%] gap-[1px] md:grid-cols-2">
      <div className="overflow-auto bg-gray-200 px-5 py-4 dark:bg-gray-800">
        <ConversationSettingsModel
          modelId={conversation.model.id}
          onModelSelect={onSelectModel}
        />
      </div>
      {model ? (
        <div className="flex max-h-full shrink flex-col gap-[1px] overflow-auto">
          {model.type === 'assistant' && assistantSubModel && (
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
          {model.type === 'model' && (
            <div className="bg-gray-200 px-5 py-4 dark:bg-gray-800">
              <SystemPrompt
                conversation={conversation}
                prompts={prompts}
                onChangePrompt={onChangePrompt}
              />
            </div>
          )}

          {model.type !== 'application' && (
            <div className="bg-gray-200 px-5 py-4 dark:bg-gray-800">
              <TemperatureSlider
                label={t('Temperature')}
                onChangeTemperature={onChangeTemperature}
                conversation={conversation}
              />
            </div>
          )}

          {model.type !== 'application' && (
            <div className="bg-gray-200 px-5 py-4 dark:bg-gray-800">
              <Addons
                preselectedAddonsIds={model.selectedAddons || []}
                selectedAddonsIds={conversation.selectedAddons}
                onChangeAddon={onChangeAddon}
                onApplyAddons={(addonsIds) => {
                  handleUpdateConversation(conversation, {
                    key: 'selectedAddons',
                    value: addonsIds,
                  });
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <div>{t('No settings available')}</div>
      )}
    </div>
  );
};

import { useContext, useState } from 'react';

import { Conversation } from '@/types/chat';
import {
  OpenAIEntityAddon,
  OpenAIEntityModel,
  OpenAIEntityModelID,
} from '@/types/openai';
import { Prompt } from '@/types/prompt';

import HomeContext from '@/pages/api/home/home.context';

import { ConversationSettings } from './ConversationSettings';

interface Props {
  conversation: Conversation;
  model: OpenAIEntityModel | undefined;
  prompts: Prompt[];
  defaultModelId: OpenAIEntityModelID;
  addons: OpenAIEntityAddon[];
  onChangeAddon: (conv: Conversation, addonId: string) => Conversation;
  onChangePrompt: (conv: Conversation, prompt: string) => Conversation;
  onChangeTemperature: (
    conv: Conversation,
    temperature: number,
  ) => Conversation;
  onSelectModel: (conv: Conversation, modelId: string) => Conversation;
  onSelectAssistantSubModel: (
    conv: Conversation,
    modelId: string,
  ) => Conversation;
  onClose: () => void;
}

export const ChatSettings = ({
  model,
  defaultModelId,
  conversation,
  prompts,
  onSelectModel,
  onSelectAssistantSubModel,
  onChangePrompt,
  onChangeTemperature,
  onChangeAddon,
  onClose,
}: Props) => {
  const {
    state: { modelsMap },
  } = useContext(HomeContext);

  const [currentModel, setCurrentModel] = useState(
    modelsMap[model?.id || defaultModelId],
  );
  const [currentPrompt, setCurrentPrompt] = useState(conversation.prompt);
  const [currentTemperature, setCurrentTemperature] = useState(
    conversation.temperature,
  );
  const [currentAssistentModelId, setCurrentAssistentModelId] = useState(
    model?.id,
  );
  const [currentSelectedAddonsIds, setCurrentSelectedAddonsIds] = useState(
    conversation.selectedAddons || [],
  );

  const handleApplyChanges = () => {
    let conv = conversation;
    if (currentModel) {
      conv = onSelectModel(conv, currentModel.id);
    }
    conv = onChangePrompt(conv, currentPrompt);
    conv = onChangeTemperature(conv, currentTemperature);
    if (currentAssistentModelId) {
      conv = onSelectAssistantSubModel(conv, currentAssistentModelId);
    }
    currentSelectedAddonsIds.forEach((addonId) => {
      conv = onChangeAddon(conv, addonId);
    });

    onClose();
  };

  return (
    <div className="absolute top-0 z-50 flex h-full w-full grow items-start overflow-auto bg-gray-900/30 p-5 dark:bg-gray-900/70">
      <div className="shrink bg-gray-300 dark:bg-gray-900">
        <ConversationSettings
          isCloseEnabled={true}
          isApplyEnabled={true}
          model={currentModel}
          prompts={prompts}
          assistantModelId={currentAssistentModelId}
          prompt={currentPrompt}
          selectedAddons={currentSelectedAddonsIds}
          temperature={currentTemperature}
          onSelectModel={(modelId: string) =>
            setCurrentModel(modelsMap[modelId])
          }
          onChangePrompt={(prompt) => setCurrentPrompt(prompt)}
          onChangeTemperature={(temperature) =>
            setCurrentTemperature(temperature)
          }
          onSelectAssistantSubModel={(modelId: string) =>
            setCurrentAssistentModelId(modelId)
          }
          onChangeAddon={(addonId: string) =>
            setCurrentSelectedAddonsIds((addons) => {
              if (addons.includes(addonId)) {
                return addons.filter((id) => id !== addonId);
              }

              return [...addons, addonId];
            })
          }
          onApplyAddons={(addons) => setCurrentSelectedAddonsIds(addons)}
          onApplySettings={handleApplyChanges}
          onClose={() => onClose()}
        />
      </div>
    </div>
  );
};

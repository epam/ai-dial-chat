import { useCallback, useEffect, useState } from 'react';

import { Conversation } from '@/src/types/chat';
import { OpenAIEntityAddon, OpenAIEntityModel } from '@/src/types/openai';
import { Prompt } from '@/src/types/prompt';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { DEFAULT_ASSISTANT_SUBMODEL } from '@/src/constants/default-settings';

import { ConversationSettings } from './ConversationSettings';

interface Props {
  conversation: Conversation;
  model: OpenAIEntityModel | undefined;
  prompts: Prompt[];
  defaultModelId: string;
  addons: OpenAIEntityAddon[];
  onClose: () => void;
  onChangeSettings: (args: {
    modelId: string | undefined;
    prompt: string;
    temperature: number;
    currentAssistentModelId: string | undefined;
    addonsIds: string[];
  }) => void;
  onApplySettings: () => void;
}

export const ChatSettings = ({
  model,
  defaultModelId,
  conversation,
  prompts,
  onClose,
  onChangeSettings,
  onApplySettings,
}: Props) => {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const [currentModel, setCurrentModel] = useState(
    modelsMap[model?.id || defaultModelId],
  );
  const [currentPrompt, setCurrentPrompt] = useState(conversation.prompt);
  const [currentTemperature, setCurrentTemperature] = useState(
    conversation.temperature,
  );
  const [currentAssistentModelId, setCurrentAssistentModelId] = useState(
    conversation.assistantModelId || DEFAULT_ASSISTANT_SUBMODEL?.id,
  );
  const [currentSelectedAddonsIds, setCurrentSelectedAddonsIds] = useState(
    conversation.selectedAddons || [],
  );

  const handleChangeSettings = useCallback(() => {
    onChangeSettings({
      modelId: currentModel?.id,
      currentAssistentModelId,
      prompt: currentPrompt,
      temperature: currentTemperature,
      addonsIds: currentSelectedAddonsIds,
    });
  }, [
    currentAssistentModelId,
    currentModel?.id,
    currentPrompt,
    currentSelectedAddonsIds,
    currentTemperature,
    onChangeSettings,
  ]);

  useEffect(() => {
    handleChangeSettings();
  }, [handleChangeSettings]);

  return (
    <div className="absolute top-0 z-50 flex h-full w-full grow items-start justify-center overflow-auto bg-gray-900/30 p-5 dark:bg-gray-900/70">
      <ConversationSettings
        isCloseEnabled={true}
        isApplyEnabled={true}
        model={currentModel}
        prompts={prompts}
        assistantModelId={currentAssistentModelId}
        prompt={currentPrompt}
        selectedAddons={currentSelectedAddonsIds}
        temperature={currentTemperature}
        onSelectModel={(modelId: string) => {
          const newModel = modelsMap[modelId];
          if (newModel) {
            setCurrentModel(newModel);
          }
        }}
        onChangePrompt={(prompt) => setCurrentPrompt(prompt)}
        onChangeTemperature={(temperature) =>
          setCurrentTemperature(temperature)
        }
        onSelectAssistantSubModel={(modelId: string) =>
          setCurrentAssistentModelId(modelId)
        }
        onChangeAddon={(addonId: string) => {
          setCurrentSelectedAddonsIds((addons) => {
            if (addons.includes(addonId)) {
              return addons.filter((id) => id !== addonId);
            }

            return [...addons, addonId];
          });
        }}
        onApplyAddons={(addons) => setCurrentSelectedAddonsIds(addons)}
        onApplySettings={() => {
          onClose();
          onApplySettings();
        }}
        onClose={() => onClose()}
      />
    </div>
  );
};

import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

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
  const { t } = useTranslation('chat');

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
    <div className="absolute z-30 flex h-full w-full grow items-start justify-center bg-gray-900/30 dark:bg-gray-900/70 md:top-0 md:p-5">
      <div className="h-full overflow-auto xl:max-w-[720px] 2xl:max-w-[1000px]">
        <ConversationSettings
          conversationId={conversation.id}
          replay={conversation.replay}
          isCloseEnabled={true}
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
          onClose={() => onClose()}
        />
        <div className="flex w-full items-center justify-center overflow-hidden bg-gray-200 px-3 py-4 dark:bg-gray-800 md:px-5">
          <button
            className="w-full rounded bg-blue-500 px-3 py-2.5 text-gray-100 hover:bg-blue-700 md:w-fit"
            data-qa="apply-changes"
            onClick={() => {
              onClose();
              onApplySettings();
            }}
          >
            {t('Apply changes')}
          </button>
        </div>
      </div>
    </div>
  );
};

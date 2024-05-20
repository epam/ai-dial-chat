import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { Conversation } from '@/src/types/chat';
import { DialAIEntityAddon } from '@/src/types/models';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { DEFAULT_ASSISTANT_SUBMODEL_ID } from '@/src/constants/default-ui-settings';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';

import { ConversationSettings } from './ConversationSettings';

interface Props {
  conversation: Conversation;
  modelId: string;
  prompts: Prompt[];
  addons: DialAIEntityAddon[];
  onClose: () => void;
  onChangeSettings: (args: {
    modelId: string | undefined;
    prompt: string;
    temperature: number;
    currentAssistentModelId: string | undefined;
    addonsIds: string[];
    isShared: boolean;
  }) => void;
  onApplySettings: () => void;
}

export const ChatSettings = ({
  modelId,
  conversation,
  prompts,
  onClose,
  onChangeSettings,
  onApplySettings,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const [currentModelId, setCurrentModelId] = useState<string>(modelId);
  const [currentPrompt, setCurrentPrompt] = useState(conversation.prompt);
  const [currentTemperature, setCurrentTemperature] = useState(
    conversation.temperature,
  );
  const [currentAssistentModelId, setCurrentAssistentModelId] = useState(
    conversation.assistantModelId || DEFAULT_ASSISTANT_SUBMODEL_ID,
  );
  const [currentSelectedAddonsIds, setCurrentSelectedAddonsIds] = useState(
    conversation.selectedAddons || [],
  );
  const [isConfirmModelChanging, setIsConfirmModelChanging] = useState(false);

  const handleOnSelectModel = (modelId: string) => {
    if (modelId) {
      setCurrentModelId(modelId);
    }
  };

  const handleOnChangePrompt = (prompt: string) => {
    setCurrentPrompt(prompt);
  };

  const handleOnChangeTemperature = (temperature: number) => {
    setCurrentTemperature(temperature);
  };

  const handleOnSelectAssistantSubModel = (modelId: string) => {
    setCurrentAssistentModelId(modelId);
  };

  const handleOnApplyAddons = (addons: string[]) => {
    setCurrentSelectedAddonsIds(addons);
  };

  const handleOnChangeAddon = (addonId: string) => {
    setCurrentSelectedAddonsIds((addons) => {
      if (addons.includes(addonId)) {
        return addons.filter((id) => id !== addonId);
      }

      return [...addons, addonId];
    });
  };

  const handleOnApplySettings = () => {
    if (conversation.isShared && currentModelId !== conversation.model.id) {
      setIsConfirmModelChanging(true);
      return;
    }

    onClose();
    onApplySettings();
  };

  const handleChangeSettings = useCallback(() => {
    onChangeSettings({
      modelId: currentModelId,
      currentAssistentModelId,
      prompt: currentPrompt,
      temperature: currentTemperature,
      addonsIds: currentSelectedAddonsIds,
      isShared: !!conversation.isShared,
    });
  }, [
    conversation.isShared,
    currentAssistentModelId,
    currentModelId,
    currentPrompt,
    currentSelectedAddonsIds,
    currentTemperature,
    onChangeSettings,
  ]);

  useEffect(() => {
    handleChangeSettings();
  }, [handleChangeSettings]);

  return (
    <div className="absolute z-30 flex size-full grow items-start justify-center bg-blackout md:top-0 md:p-5">
      <div className="max-h-full w-full overflow-auto rounded xl:max-w-[720px] 2xl:max-w-[1000px]">
        <div className="flex flex-col divide-y divide-secondary bg-layer-2">
          <ConversationSettings
            conversation={conversation}
            isCloseEnabled
            modelId={currentModelId}
            prompts={prompts}
            assistantModelId={currentAssistentModelId}
            prompt={currentPrompt}
            selectedAddons={currentSelectedAddonsIds}
            temperature={currentTemperature}
            onSelectModel={handleOnSelectModel}
            onChangePrompt={handleOnChangePrompt}
            onChangeTemperature={handleOnChangeTemperature}
            onSelectAssistantSubModel={handleOnSelectAssistantSubModel}
            onChangeAddon={handleOnChangeAddon}
            onApplyAddons={handleOnApplyAddons}
            onClose={onClose}
          />
          <div className="flex w-full items-center justify-end overflow-hidden bg-layer-2 px-3 py-4 md:px-5">
            <button
              className="button button-primary"
              data-qa="apply-changes"
              onClick={handleOnApplySettings}
            >
              {t('Apply changes')}
            </button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={isConfirmModelChanging}
        heading={t('Confirm model changing')}
        confirmLabel={t('Rename')}
        cancelLabel={t('Cancel')}
        description={
          t(
            'Model changing will stop sharing and other users will no longer see this conversation.',
          ) || ''
        }
        onClose={(result) => {
          setIsConfirmModelChanging(false);

          if (result) {
            onClose();
            onChangeSettings({
              modelId: currentModelId,
              currentAssistentModelId,
              prompt: currentPrompt,
              temperature: currentTemperature,
              addonsIds: currentSelectedAddonsIds,
              isShared: false,
            });
            onApplySettings();
          }
        }}
      />
    </div>
  );
};

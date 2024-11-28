import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { DefaultsService } from '@/src/utils/app/data/defaults-service';

import { Conversation } from '@/src/types/chat';
import { ModalState } from '@/src/types/modal';
import { DialAIEntityAddon } from '@/src/types/models';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { FALLBACK_ASSISTANT_SUBMODEL_ID } from '@/src/constants/default-ui-settings';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';

import Modal from '../Common/Modal';
import { ConversationSettings } from './ConversationSettings';

interface Props {
  conversation: Conversation;
  modelId: string;
  prompts: Prompt[];
  addons: DialAIEntityAddon[];
  isOpen: boolean;
  isRight?: boolean;
  isCompareMode?: boolean;
  onClose: () => void;
  onChangeSettings: (args: {
    modelId: string;
    prompt: string;
    temperature: number;
    currentAssistantModelId: string | undefined;
    addonsIds: string[];
    isShared: boolean;
  }) => void;
  onApplySettings: () => void;
}

export const ChatSettings = ({
  modelId,
  conversation,
  prompts,
  isOpen,
  isRight,
  isCompareMode,
  onClose,
  onChangeSettings,
  onApplySettings,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const [currentPrompt, setCurrentPrompt] = useState(conversation.prompt);
  const [currentTemperature, setCurrentTemperature] = useState(
    conversation.temperature,
  );
  const [currentAssistantModelId, setCurrentAssistantModelId] = useState(
    conversation.assistantModelId ??
      DefaultsService.get('assistantSubmodelId') ??
      FALLBACK_ASSISTANT_SUBMODEL_ID,
  );
  const [currentSelectedAddonsIds, setCurrentSelectedAddonsIds] = useState(
    conversation.selectedAddons || [],
  );
  const [isConfirmModelChanging, setIsConfirmModelChanging] = useState(false);

  const handleOnChangeAddon = useCallback((addonId: string) => {
    setCurrentSelectedAddonsIds((addons) => {
      if (addons.includes(addonId)) {
        return addons.filter((id) => id !== addonId);
      }

      return [...addons, addonId];
    });
  }, []);

  const handleOnApplySettings = () => {
    if (conversation.isShared) {
      setIsConfirmModelChanging(true);
      return;
    }

    onClose();
    onApplySettings();
  };

  const handleChangeSettings = useCallback(() => {
    onChangeSettings({
      currentAssistantModelId,
      modelId,
      prompt: currentPrompt,
      temperature: currentTemperature,
      addonsIds: currentSelectedAddonsIds,
      isShared: !!conversation.isShared,
    });
  }, [
    conversation.isShared,
    currentAssistantModelId,
    currentPrompt,
    currentSelectedAddonsIds,
    currentTemperature,
    modelId,
    onChangeSettings,
  ]);

  useEffect(() => {
    handleChangeSettings();
  }, [handleChangeSettings]);

  return (
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={onClose}
      dataQa="chat-settings-modal"
      overlayClassName={classNames(
        '!z-40 !items-start',
        isCompareMode && 'w-1/2 portrait:hidden',
        isRight && 'justify-self-end',
      )}
      containerClassName="flex h-fit max-h-full flex-col rounded py-3 md:py-4 w-full grow items-start justify-center !bg-layer-2 md:max-w-[500px]"
      dismissProps={{ outsidePressEvent: 'mousedown' }}
    >
      <div className="size-full divide-y divide-tertiary">
        <div className="mb-3 px-3 text-base font-semibold md:px-6">
          {t('Conversation settings')}
        </div>

        <ConversationSettings
          conversation={conversation}
          modelId={modelId}
          prompts={prompts}
          assistantModelId={currentAssistantModelId}
          prompt={currentPrompt}
          selectedAddons={currentSelectedAddonsIds}
          temperature={currentTemperature}
          onChangePrompt={setCurrentPrompt}
          onChangeTemperature={setCurrentTemperature}
          onSelectAssistantSubModel={setCurrentAssistantModelId}
          onChangeAddon={handleOnChangeAddon}
          onApplyAddons={setCurrentSelectedAddonsIds}
        />
        <div className="flex w-full items-center justify-end px-3 pt-4 md:px-5">
          <button
            className="button button-primary"
            data-qa="apply-changes"
            onClick={handleOnApplySettings}
          >
            {t('Apply changes')}
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmModelChanging}
        heading={t('Confirm model changing')}
        confirmLabel={t('Confirm')}
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
              modelId,
              currentAssistantModelId,
              prompt: currentPrompt,
              temperature: currentTemperature,
              addonsIds: currentSelectedAddonsIds,
              isShared: false,
            });
            onApplySettings();
          }
        }}
      />
    </Modal>
  );
};

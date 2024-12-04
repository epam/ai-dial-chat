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

import Modal from '@/src/components/Common/Modal';

import { ConversationSettings } from './ConversationSettings';

interface Props {
  conversation: Conversation;
  prompts: Prompt[];
  addons: DialAIEntityAddon[];
  isOpen: boolean;
  isRight?: boolean;
  isCompareMode?: boolean;
  onClose: () => void;
  onChangeSettings: (
    conv: Conversation,
    args: {
      modelId: string;
      prompt: string;
      temperature: number;
      currentAssistantModelId: string | undefined;
      addonsIds: string[];
      isShared: boolean;
    },
  ) => void;
  onApplySettings: () => void;
}

export const ChatSettings = ({
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
      DefaultsService.get(
        'assistantSubmodelId',
        FALLBACK_ASSISTANT_SUBMODEL_ID,
      ),
  );
  const [currentSelectedAddonsIds, setCurrentSelectedAddonsIds] = useState(
    conversation.selectedAddons || [],
  );

  const handleOnChangeAddon = useCallback((addonId: string) => {
    setCurrentSelectedAddonsIds((addons) => {
      if (addons.includes(addonId)) {
        return addons.filter((id) => id !== addonId);
      }

      return [...addons, addonId];
    });
  }, []);

  const handleOnApplySettings = () => {
    onClose();
    onApplySettings();
  };

  const handleChangeSettings = useCallback(() => {
    onChangeSettings(conversation, {
      currentAssistantModelId,
      modelId: conversation.model.id,
      prompt: currentPrompt,
      temperature: currentTemperature,
      addonsIds: currentSelectedAddonsIds,
      isShared: !!conversation.isShared,
    });
  }, [
    conversation,
    currentAssistantModelId,
    currentPrompt,
    currentSelectedAddonsIds,
    currentTemperature,
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
        '!z-40',
        isCompareMode && 'w-1/2 portrait:hidden',
        isRight && 'justify-self-end',
      )}
      containerClassName="flex h-fit max-h-full divide-y divide-tertiary flex-col rounded py-3 md:py-4 w-full grow items-start justify-center !bg-layer-2 md:max-w-[500px]"
      dismissProps={{ outsidePressEvent: 'mousedown' }}
    >
      <div className="mb-3 !border-t-0 px-3 text-base font-semibold md:px-6">
        {t('Conversation settings')}
      </div>

      <ConversationSettings
        conversation={conversation}
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
    </Modal>
  );
};

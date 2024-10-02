import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { DefaultsService } from '@/src/utils/app/data/defaults-service';

import { Conversation } from '@/src/types/chat';
import { ModalState } from '@/src/types/modal';
import { DialAIEntityAddon } from '@/src/types/models';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';
import { FALLBACK_ASSISTANT_SUBMODEL_ID } from '@/src/constants/default-ui-settings';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';

import Modal from '../Common/Modal';
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
  isOpen: boolean;
  isRight?: boolean;
  isCompareMode?: boolean;
}

export const ChatSettings = ({
  modelId,
  conversation,
  prompts,
  onClose,
  onChangeSettings,
  onApplySettings,
  isOpen,
  isRight,
  isCompareMode,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const [currentModelId, setCurrentModelId] = useState<string>(
    conversation.replay?.replayAsIs ? REPLAY_AS_IS_MODEL : modelId,
  );
  const [currentPrompt, setCurrentPrompt] = useState(conversation.prompt);
  const [currentTemperature, setCurrentTemperature] = useState(
    conversation.temperature,
  );
  const [currentAssistentModelId, setCurrentAssistentModelId] = useState(
    conversation.assistantModelId ??
      DefaultsService.get('assistantSubmodelId') ??
      FALLBACK_ASSISTANT_SUBMODEL_ID,
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
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={() => {
        return;
      }}
      hideClose
      dataQa="chat-settings-modal"
      overlayClassName={classNames(
        '!z-40 !items-start',
        isCompareMode && 'w-1/2 portrait:hidden',
        isRight && 'justify-self-end',
      )}
      containerClassName="flex h-fit max-h-full flex-col rounded py-3 md:py-4 w-full grow items-start justify-center !bg-layer-2 xl:max-w-[720px] 2xl:max-w-[1000px]"
      dismissProps={{ outsidePressEvent: 'mousedown' }}
    >
      <div className="mb-3 bg-layer-2 px-3 text-base font-semibold md:px-6">
        {t('Conversation settings')}
      </div>

      <ConversationSettings
        conversation={conversation}
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
        isCloseEnabled
      />
      <div className="flex w-full items-center justify-end border-t-[1px] border-tertiary px-3 pt-4 md:px-5">
        <button
          className="button button-primary"
          data-qa="apply-changes"
          onClick={handleOnApplySettings}
        >
          {t('Apply changes')}
        </button>
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
    </Modal>
  );
};

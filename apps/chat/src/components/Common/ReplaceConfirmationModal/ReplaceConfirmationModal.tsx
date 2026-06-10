import { useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Conversation } from '@/src/types/chat';
import { MappedReplaceActions } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { ModalState } from '@/src/types/modal';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { OUTSIDE_PRESS_AND_MOUSE_EVENT } from '@/src/constants/modal';

import { Modal } from '@/src/components/Common/Modal';

import { ConversationsList } from './ConversationsList';
import { FilesList } from './FilesList';
import { PromptsList } from './PromptsList';
import { ReplaceSelector } from './ReplaceSelector';
import { useReplaceConfirmationState } from './useReplaceConfirmationState';

import { DialNeutralButton, DialPrimaryButton } from '@epam/ai-dial-ui-kit';

export interface ReplaceConfirmationModalProps {
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (mappedActions: MappedReplaceActions) => void;
  conversations?: Conversation[];
  prompts?: Prompt[];
  duplicatedFiles?: DialFile[];
  cancelDataQa?: string;
  confirmDataQa?: string;
}

export function ReplaceConfirmationModal({
  title,
  description,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  conversations,
  prompts,
  duplicatedFiles,
  cancelDataQa = 'cancel-import',
  confirmDataQa = 'continue-import',
}: ReplaceConfirmationModalProps) {
  const { t } = useTranslation(Translation.Chat);

  const {
    mappedActions,
    actionForAllItems,
    conversationsFolders,
    promptsFolders,
    filesFolders,
    featureGeneralProps,
    handleOnChangeAllAction,
  } = useReplaceConfirmationState({
    conversations,
    prompts,
    duplicatedFiles,
  });

  const handleConfirm = useCallback(() => {
    onConfirm(mappedActions);
  }, [mappedActions, onConfirm]);

  return (
    <Modal
      portalId="theme-main"
      state={ModalState.OPENED}
      onClose={() => {
        return;
      }}
      hideClose
      dataQa="replace-confirmation-modal"
      containerClassName="flex w-full min-h-[595px] flex-col gap-4 pt-4 sm:w-[525px] md:pt-6"
      dismissProps={OUTSIDE_PRESS_AND_MOUSE_EVENT}
    >
      <div className="flex h-fit flex-col gap-2 px-3 md:px-6">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-secondary">{description}</p>
        <div
          className="flex h-fit flex-row items-center justify-between overflow-y-scroll border-b border-tertiary pl-3"
          data-qa="all-items-selector"
        >
          <span>{t(ChatI18nKeys.AllItems)}</span>
          <ReplaceSelector
            selectedOption={actionForAllItems}
            onOptionChangeHandler={handleOnChangeAllAction}
          />
        </div>
      </div>
      <div className="flex shrink flex-col overflow-y-scroll px-3 md:px-6">
        <div
          className="flex flex-col pl-3"
          data-qa="main-folder-tree"
        >
          {conversations && (
            <ConversationsList
              conversationsToReplace={conversations}
              folders={conversationsFolders}
              {...featureGeneralProps}
            />
          )}
          {duplicatedFiles && duplicatedFiles.length > 0 && (
            <FilesList
              duplicatedFiles={duplicatedFiles}
              folders={filesFolders}
              {...featureGeneralProps}
            />
          )}
          {prompts && (
            <PromptsList
              promptsToReplace={prompts}
              folders={promptsFolders}
              {...featureGeneralProps}
            />
          )}
        </div>
      </div>

      <div className="mt-auto flex h-fit flex-row justify-end gap-3 border-t border-tertiary px-3 py-4 md:px-6 md:pb-4">
        <DialNeutralButton
          onClick={onCancel}
          label={cancelLabel}
          data-qa={cancelDataQa}
        />
        <DialPrimaryButton
          onClick={handleConfirm}
          label={confirmLabel}
          data-qa={confirmDataQa}
        />
      </div>
    </Modal>
  );
}

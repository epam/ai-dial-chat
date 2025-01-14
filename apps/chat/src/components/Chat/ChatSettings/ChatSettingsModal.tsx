import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { DefaultsService } from '@/src/utils/app/data/defaults-service';
import { doesModelHaveSettings } from '@/src/utils/app/models';

import { Conversation } from '@/src/types/chat';
import { ModalState } from '@/src/types/modal';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { PromptsSelectors } from '@/src/store/prompts/prompts.reducers';

import { FALLBACK_ASSISTANT_SUBMODEL_ID } from '@/src/constants/default-ui-settings';

import Modal from '@/src/components/Common/Modal';

import { ModelIcon } from '../../Chatbar/ModelIcon';
import { ConversationSettings } from './ConversationSettings';

interface ChatSettingsViewProps {
  conversation: Conversation;
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
}

const ChatSettingsView = ({
  conversation,
  onChangeSettings,
}: ChatSettingsViewProps) => {
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

  const prompts = useAppSelector(PromptsSelectors.selectPrompts);

  const handleOnChangeAddon = useCallback((addonId: string) => {
    setCurrentSelectedAddonsIds((addons) => {
      if (addons.includes(addonId)) {
        return addons.filter((id) => id !== addonId);
      }

      return [...addons, addonId];
    });
  }, []);

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
  );
};

interface Props {
  conversations: Conversation[];
  isOpen: boolean;
  isCompareMode: boolean;
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
  conversations,
  isOpen,
  isCompareMode,
  onClose,
  onChangeSettings,
  onApplySettings,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const handleOnApplySettings = () => {
    onClose();
    onApplySettings();
  };

  const isSomethingConfigurable = useMemo(() => {
    const allowedModels = conversations
      .map((conv) => modelsMap[conv.model.id])
      .filter(Boolean) as DialAIEntityModel[];

    return allowedModels.some((model) => doesModelHaveSettings(model));
  }, [conversations, modelsMap]);

  return (
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={onClose}
      dataQa="chat-settings-modal"
      overlayClassName={classNames(
        '!z-40',
        isCompareMode && 'hidden landscape:flex',
      )}
      containerClassName={classNames(
        'flex max-h-full w-full flex-col divide-y divide-tertiary rounded !bg-layer-2',
        isCompareMode ? 'md:max-w-[1000px]' : 'md:max-w-[500px]',
        isSomethingConfigurable ? 'py-3 md:py-4' : 'pt-3 md:pt-4',
      )}
      dismissProps={{ outsidePressEvent: 'mousedown' }}
    >
      <div className="mb-3 !border-t-0 px-3 text-base font-semibold md:px-6">
        {t('Conversation settings')}
      </div>

      {conversations.length === 2 && (
        <div className="flex divide-x divide-tertiary">
          {conversations.map((conversation) => {
            const model = modelsMap[conversation.model.id];

            return (
              <div
                key={conversation.id}
                className="flex w-1/2 items-center gap-4 overflow-hidden p-4 px-3 md:px-6"
              >
                <div className="flex shrink-0 items-center justify-center xl:my-[3px]">
                  <ModelIcon
                    entityId={conversation.model.id}
                    entity={model}
                    size={48}
                  />
                </div>
                <div className="flex grow flex-col justify-center gap-2 overflow-hidden leading-4">
                  {model?.version && (
                    <div className="flex items-center">
                      <p className="mr-1 text-xs text-secondary">
                        {t('Version')}: {model.version}
                      </p>
                    </div>
                  )}
                  <div className="flex whitespace-nowrap">
                    <div
                      className={classNames(
                        'shrink truncate text-base font-semibold leading-[19px] text-primary',
                        !model ? 'text-secondary' : 'text-primary',
                      )}
                      data-qa="agent-name"
                    >
                      {model?.name ?? conversation.model.id}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex divide-x divide-tertiary overflow-hidden">
        {conversations.map((conversation) => (
          <div
            className={classNames(
              'overflow-auto',
              conversations.length === 1
                ? 'w-full'
                : 'w-1/2 divide-y divide-tertiary',
            )}
            key={conversation.id}
          >
            <ChatSettingsView
              conversation={conversation}
              onChangeSettings={onChangeSettings}
            />
          </div>
        ))}
      </div>
      {isSomethingConfigurable && (
        <div className="flex w-full items-center justify-end px-3 pt-4 md:px-5">
          <button
            className="button button-primary"
            data-qa="apply-changes"
            onClick={handleOnApplySettings}
          >
            {t('Apply changes')}
          </button>
        </div>
      )}
    </Modal>
  );
};

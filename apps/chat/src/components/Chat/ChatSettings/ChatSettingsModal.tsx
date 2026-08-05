import { useCallback, useEffect, useMemo, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getModelName } from '@/src/utils/app/application';
import { isCreatedMarketplaceEntity } from '@/src/utils/app/marketplace';

import { Conversation, ConversationsTemporarySettings } from '@/src/types/chat';
import { ModalState } from '@/src/types/modal';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import {
  ModelsSelectors,
  PromptsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { MOUSE_OUTSIDE_PRESS_EVENT } from '@/src/constants/modal';
import { NA_VERSION } from '@/src/constants/publication';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { Modal } from '@/src/components/Common/Modal';

import { ConversationSettings } from './ConversationSettings';

import { ConversationResponseFormat } from '@epam/ai-dial-shared';
import { DialPrimaryButton } from '@epam/ai-dial-ui-kit';

interface ChatSettingsViewProps {
  conversation: Conversation;
  onChangeSettings: (
    conv: Conversation,
    args: ConversationsTemporarySettings,
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
  const [responseFormat, setResponseFormat] = useState(
    conversation.responseFormat ?? ConversationResponseFormat.Markdown,
  );

  const prompts = useAppSelector(PromptsSelectors.selectPrompts);

  const handleChangeSettings = useCallback(() => {
    onChangeSettings(conversation, {
      modelId: conversation.model.id,
      prompt: currentPrompt,
      temperature: currentTemperature,
      isShared: !!conversation.isShared,
      responseFormat,
    });
  }, [
    conversation,
    currentPrompt,
    currentTemperature,
    onChangeSettings,
    responseFormat,
  ]);

  useEffect(() => {
    handleChangeSettings();
  }, [handleChangeSettings]);

  return (
    <ConversationSettings
      conversation={conversation}
      prompts={prompts}
      prompt={currentPrompt}
      temperature={currentTemperature}
      onChangePrompt={setCurrentPrompt}
      onChangeTemperature={setCurrentTemperature}
      responseFormat={responseFormat}
      onChangeResponseFormat={setResponseFormat}
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
    args: ConversationsTemporarySettings,
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
  const locale = useAppSelector(UISelectors.selectLocale);

  const handleOnApplySettings = () => {
    onClose();
    onApplySettings();
  };

  const isSomethingConfigurable = useMemo(() => {
    const allowedModels = conversations
      .map((conv) => modelsMap[conv.model.id])
      .filter(Boolean) as DialAIEntityModel[];

    return !!allowedModels.length;
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
      dismissProps={MOUSE_OUTSIDE_PRESS_EVENT}
    >
      <div className="mb-3 !border-t-0 px-3 text-base font-semibold md:px-6">
        {t(ChatI18nKeys.ConversationSettings)}
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
                  {model &&
                    (isCreatedMarketplaceEntity(model) || model.version) && (
                      <div className="flex items-center">
                        <p className="mr-1 text-xs text-secondary">
                          {t(ChatI18nKeys.Version)}:{' '}
                          {model.version || t(NA_VERSION)}
                        </p>
                      </div>
                    )}
                  <div className="flex whitespace-nowrap">
                    <div
                      className={classNames(
                        'shrink truncate text-base font-semibold leading-[19px] text-primary',
                        !model ? 'text-secondary' : 'text-primary',
                      )}
                      data-qa="entity-name"
                    >
                      {getModelName(model, locale) || conversation.model.id}
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
          <DialPrimaryButton
            label={t(ChatI18nKeys.ApplyChanges)}
            onClick={handleOnApplySettings}
            data-qa="apply-changes"
          />
        </div>
      )}
    </Modal>
  );
};

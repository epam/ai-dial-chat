import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityNameOrPathInvalid } from '@/src/utils/app/common';
import { isPlaybackConversation } from '@/src/utils/app/conversation';
import {
  getConfigurationValue,
  getMessageFormValue,
  isMessageInputDisabled,
} from '@/src/utils/app/form-schema';
import { isEntityReadOnly } from '@/src/utils/app/permissions';
import { getEntitiesFromTemplateMapping } from '@/src/utils/app/prompts';

import { Conversation } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors, SettingsSelectors } from '@/src/store/selectors';

import { MessageAssistantButtons } from '@/src/components/Chat/ChatMessage/MessageButtons';
import { AssistantSchema } from '@/src/components/Chat/ChatMessage/MessageSchema/MessageSchema';
import { MessageAttachments } from '@/src/components/Chat/MessageAttachments';
import { MessageStages } from '@/src/components/Chat/MessageStages';
import { ErrorMessage } from '@/src/components/Common/ErrorMessage';
import { ChatMDComponent } from '@/src/components/Markdown/ChatMDComponent';

import { AdjustedTextarea } from '../AdjustedTextarea';
import { OverlayMessageCustomButtons } from './OverlayMessageCustomButtons';

import {
  Feature,
  Message,
  MessageFormValue,
  onLikeMessageHandler,
} from '@epam/ai-dial-shared';
import isEqual from 'lodash-es/isEqual';

interface AssistantMessageProps {
  messageIndex: number;
  realMessageIndex: number;
  message: Message;
  allMessages: Message[];
  conversation: Conversation;
  isLastMessage: boolean;
  isLikesEnabled: boolean;
  isEditing: boolean;
  withButtons?: boolean;
  messageCopied?: boolean;
  onCopy?: () => void;
  onLike?: onLikeMessageHandler;
  onRegenerate?: () => void;
  onToggleEditing: (value: boolean) => void;
  onEdit?: (
    editedMessage: Message,
    index: number,
    conversationId: string,
  ) => void;
}

export const AssistantMessage = memo(function AssistantMessage({
  messageIndex,
  realMessageIndex,
  message,
  allMessages,
  conversation,
  isLastMessage,
  isEditing,
  withButtons,
  isLikesEnabled,
  messageCopied,
  onCopy,
  onLike,
  onRegenerate,
  onToggleEditing,
  onEdit,
}: AssistantMessageProps) {
  const { t } = useTranslation(Translation.Chat);

  const currentFormValue = useMemo(
    () => getMessageFormValue(message) ?? getConfigurationValue(message),
    [message],
  );

  const anchorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageContent = message.content;
  const [inputMessageContent, setInputMessageContent] =
    useState(messageContent);
  const [formValue, setFormValue] = useState(currentFormValue);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [shouldScroll, setShouldScroll] = useState(false);

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const resourcesToReview = useAppSelector(
    PublicationSelectors.selectResourcesToReview,
  );
  const codeWarning = useAppSelector(SettingsSelectors.selectCodeWarning);
  const isEditLastMessageEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.EditLastAssistantContent),
  );
  const isAllLastMessageEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.EditAllAssistantContent),
  );

  const isShowResponseLoader =
    !!conversation.isMessageStreaming && isLastMessage;
  const isConversationInvalid = isEntityNameOrPathInvalid(conversation);

  const isReadOnlyConversation = isEntityReadOnly(conversation);
  const isPublishingConversation = useMemo(
    () => !!resourcesToReview.find((r) => r.reviewUrl === conversation.id),
    [conversation.id, resourcesToReview],
  );

  const codeRegEx =
    /(?:(?:^|\n)[ \t]*`{3}[\s\S]*?(?:^|\n)[ \t]*`{3}|(?:^|\n)(?: {4}|\t)[^\n]*)/g;
  const codeDetection = (content: string) => content.match(codeRegEx);

  const isInputDisabled = isMessageInputDisabled(messageIndex, allMessages);
  const isInputHidden = isInputDisabled && !messageContent;

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputMessageContent(event.target.value);
    },
    [],
  );

  const handleToggleEditing = useCallback(
    (value?: boolean) => {
      onToggleEditing(value ?? !isEditing);
      setShouldScroll(true);
    },
    [isEditing, onToggleEditing],
  );

  const handleEditMessage = useCallback(
    (formValue?: MessageFormValue, newContent?: string) => {
      if (!conversation || !onEdit) return;

      const isFormValueChanged = !isEqual(
        getMessageFormValue(message) ?? getConfigurationValue(message),
        formValue,
      );
      const content = newContent ?? inputMessageContent;
      const isContentChanged = messageContent !== content;

      if (isContentChanged || isFormValueChanged) {
        onEdit(
          {
            ...message,
            content: content,
            templateMapping: getEntitiesFromTemplateMapping(
              message.templateMapping,
            ).filter(([key]) => inputMessageContent.includes(key)),
          },
          messageIndex,
          conversation.id,
        );
      }
      handleToggleEditing(false);
    },
    [
      conversation,
      onEdit,
      message,
      messageContent,
      inputMessageContent,
      handleToggleEditing,
      messageIndex,
    ],
  );

  const handlePressEnter = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !isTyping && !e.shiftKey) {
        e.preventDefault();
        handleEditMessage(formValue, inputMessageContent);
      }
    },
    [formValue, handleEditMessage, isTyping, inputMessageContent],
  );

  const handleCancelEditing = useCallback(() => {
    setInputMessageContent(messageContent);
    handleToggleEditing(false);
  }, [handleToggleEditing, messageContent]);

  useEffect(() => {
    if (isEditing) {
      setInputMessageContent(messageContent);
    }
  }, [isEditing, messageContent]);

  useEffect(() => {
    setFormValue(currentFormValue);
  }, [currentFormValue, isEditing]);

  useEffect(() => {
    if (isEditing) {
      setShouldScroll(true);
    }
  }, [isEditing]);

  useEffect(() => {
    if (shouldScroll) {
      anchorRef.current?.scrollIntoView({ block: 'end' });
      setShouldScroll(false);
    }
  }, [shouldScroll]);

  if (isEditing)
    return (
      <div className="flex w-full flex-col gap-3">
        <AssistantSchema message={message} isLastMessage={isLastMessage} />

        {!isInputHidden && (
          <div
            className={classNames(
              'relative min-h-[100px] rounded border border-primary bg-layer-3 px-3 py-2 focus-within:border-accent-primary',
              !isOverlay && 'text-base',
            )}
          >
            <AdjustedTextarea
              ref={textareaRef}
              className="w-full grow resize-none whitespace-pre-wrap bg-transparent focus-visible:outline-none"
              value={inputMessageContent}
              onChange={handleInputChange}
              onKeyDown={handlePressEnter}
              disabled={isInputDisabled}
              onCompositionStart={() => setIsTyping(true)}
              onCompositionEnd={() => setIsTyping(false)}
              style={{
                fontFamily: 'inherit',
                fontSize: 'inherit',
                lineHeight: 'inherit',
                margin: '0',
                overflow: 'hidden',
              }}
            />
          </div>
        )}

        <div className="flex items-center justify-end">
          <div className="relative flex gap-3">
            <button
              className="button button-secondary"
              onClick={handleCancelEditing}
              data-qa="cancel"
            >
              {t('Cancel')}
            </button>
            {!isInputHidden && (
              <button
                className="button button-primary"
                onClick={() =>
                  handleEditMessage(formValue, inputMessageContent)
                }
                disabled={!inputMessageContent}
                data-qa="save-and-submit"
              >
                {t('Save & Submit')}
              </button>
            )}
            <div ref={anchorRef} className="absolute bottom-0"></div>
          </div>
        </div>
      </div>
    );

  return (
    <>
      <div
        className={classNames(
          'flex min-w-0 shrink grow flex-col',
          (messageContent ||
            message.errorMessage ||
            message.custom_content?.attachments) &&
            'gap-4',
        )}
      >
        {!!message.custom_content?.stages?.length && (
          <MessageStages stages={message.custom_content?.stages} />
        )}
        {!!(messageContent || isShowResponseLoader) && (
          <ChatMDComponent
            isShowResponseLoader={isShowResponseLoader}
            content={messageContent}
          />
        )}
        {codeWarning &&
          codeWarning.length !== 0 &&
          codeDetection(messageContent) && (
            <div className="select-none text-xxs text-error">
              {t(codeWarning)}
            </div>
          )}
        {!(
          conversation.isMessageStreaming &&
          isPlaybackConversation(conversation) &&
          isLastMessage
        ) && (
          <MessageAttachments
            attachments={message.custom_content?.attachments}
          />
        )}
        <AssistantSchema isLastMessage={isLastMessage} message={message} />
        <ErrorMessage error={message.errorMessage}></ErrorMessage>

        {isOverlay && (
          <OverlayMessageCustomButtons realMessageIndex={realMessageIndex} />
        )}
      </div>
      {withButtons &&
        (!conversation.isMessageStreaming || !isLastMessage) &&
        !isConversationInvalid && (
          <MessageAssistantButtons
            copyOnClick={() => onCopy?.()}
            isLikesEnabled={isLikesEnabled}
            message={message}
            realMessageIndex={realMessageIndex}
            messageCopied={messageCopied}
            onLike={onLike}
            onRegenerate={onRegenerate}
            onToggleEditing={
              !isPlaybackConversation(conversation) &&
              (isAllLastMessageEnabled ||
                (isLastMessage && isEditLastMessageEnabled)) &&
              (!isReadOnlyConversation || isPublishingConversation)
                ? handleToggleEditing
                : undefined
            }
          />
        )}
    </>
  );
});

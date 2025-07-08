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
import { getEntitiesFromTemplateMapping } from '@/src/utils/app/prompts';

import { Conversation } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { MessageAssistantButtons } from '@/src/components/Chat/ChatMessage/MessageButtons';
import { AssistantSchema } from '@/src/components/Chat/ChatMessage/MessageSchema/MessageSchema';
import { MessageAttachments } from '@/src/components/Chat/MessageAttachments';
import { MessageStages } from '@/src/components/Chat/MessageStages';
import { ErrorMessage } from '@/src/components/Common/ErrorMessage';
import { ChatMDComponent } from '@/src/components/Markdown/ChatMDComponent';

import { AdjustedTextarea } from '../AdjustedTextarea';
import { MessageCustomButtons } from './MessageCustomButtons';

import {
  Feature,
  LikeState,
  Message,
  MessageFormValue,
} from '@epam/ai-dial-shared';
import { isEqual } from 'lodash-es';

interface AssistantMessageProps {
  messageIndex: number;
  message: Message;
  allMessages: Message[];
  isFirstMessageSystem: boolean;
  conversation: Conversation;
  isLastMessage: boolean;
  isLikesEnabled: boolean;
  isEditing: boolean;
  withButtons?: boolean;
  messageCopied?: boolean;
  onCopy?: () => void;
  onLike?: (likeStatus: LikeState) => void;
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
  message,
  allMessages,
  isFirstMessageSystem,
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
  const [messageContent, setMessageContent] = useState(message.content);
  const [formValue, setFormValue] = useState(currentFormValue);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [shouldScroll, setShouldScroll] = useState(false);

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
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

  const codeRegEx =
    /(?:(?:^|\n)[ \t]*`{3}[\s\S]*?(?:^|\n)[ \t]*`{3}|(?:^|\n)(?: {4}|\t)[^\n]*)/g;
  const codeDetection = (content: string) => content.match(codeRegEx);

  const isInputDisabled = isMessageInputDisabled(messageIndex, allMessages);
  const isInputHidden = isInputDisabled && !message.content;

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMessageContent(event.target.value);
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
      const isContentChanged =
        message.content !== (newContent ?? messageContent);

      if (isContentChanged || isFormValueChanged) {
        onEdit(
          {
            ...message,
            content: newContent ?? messageContent,
            templateMapping: getEntitiesFromTemplateMapping(
              message.templateMapping,
            ).filter(([key]) => messageContent.includes(key)),
          },
          messageIndex,
          conversation.id,
        );
      }
      handleToggleEditing(false);
    },
    [
      message,
      messageContent,
      handleToggleEditing,
      conversation,
      onEdit,
      messageIndex,
    ],
  );

  const handlePressEnter = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !isTyping && !e.shiftKey) {
        e.preventDefault();
        handleEditMessage(formValue, messageContent);
      }
    },
    [formValue, handleEditMessage, isTyping, messageContent],
  );

  const handleCancelEditing = useCallback(() => {
    setMessageContent(message.content);
    handleToggleEditing(false);
  }, [handleToggleEditing, message.content]);

  useEffect(() => {
    setMessageContent(message.content);
  }, [message.content]);

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
              value={messageContent}
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
                onClick={() => handleEditMessage(formValue, messageContent)}
                disabled={!messageContent}
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
          (message.content ||
            message.errorMessage ||
            message.custom_content?.attachments) &&
            'gap-4',
        )}
      >
        {!!message.custom_content?.stages?.length && (
          <MessageStages stages={message.custom_content?.stages} />
        )}
        {!!(message.content || isShowResponseLoader) && (
          <ChatMDComponent
            isShowResponseLoader={isShowResponseLoader}
            content={message.content}
          />
        )}
        {codeWarning &&
          codeWarning.length !== 0 &&
          codeDetection(message.content) && (
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
          <MessageCustomButtons
            messageIndex={messageIndex}
            isSystemMessagePresented={isFirstMessageSystem}
          />
        )}
      </div>
      {withButtons &&
        (!conversation.isMessageStreaming || !isLastMessage) &&
        !isConversationInvalid && (
          <MessageAssistantButtons
            copyOnClick={() => onCopy?.()}
            isLikesEnabled={isLikesEnabled}
            message={message}
            messageCopied={messageCopied}
            onLike={(likeStatus) => onLike?.(likeStatus)}
            onRegenerate={onRegenerate}
            onToggleEditing={
              isAllLastMessageEnabled ||
              (isLastMessage && isEditLastMessageEnabled)
                ? handleToggleEditing
                : undefined
            }
          />
        )}
    </>
  );
});

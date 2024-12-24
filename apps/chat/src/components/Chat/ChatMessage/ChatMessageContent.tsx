import { IconUser } from '@tabler/icons-react';
import { MouseEvent, RefObject, useRef } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { isEntityNameOrPathInvalid } from '@/src/utils/app/common';
import { isSmallScreen } from '@/src/utils/app/mobile';

import { Conversation } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { MessageAssistantButtons } from '@/src/components/Chat/ChatMessage/MessageButtons';
import { MessageSchema } from '@/src/components/Chat/ChatMessage/MessageSchema/MessageSchema';
import { UserMessage } from '@/src/components/Chat/ChatMessage/UserMessage';
import { MessageAttachments } from '@/src/components/Chat/MessageAttachments';
import { MessageStages } from '@/src/components/Chat/MessageStages';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { ErrorMessage } from '@/src/components/Common/ErrorMessage';
import ChatMDComponent from '@/src/components/Markdown/ChatMDComponent';

import { LikeState, Message, Role } from '@epam/ai-dial-shared';

export interface Props {
  message: Message;
  messageIndex: number;
  conversation: Conversation;
  isLikesEnabled: boolean;
  isEditing: boolean;
  isLastMessage: boolean;
  toggleEditing: (value: boolean) => void;
  isEditingTemplates: boolean;
  toggleEditingTemplates: (value: boolean) => void;
  messageCopied?: boolean;
  editDisabled?: boolean;
  onRegenerate?: () => void;
  onEdit?: (editedMessage: Message, index: number) => void;
  onCopy?: () => void;
  onLike?: (likeStatus: LikeState) => void;
  onDelete?: () => void;
  onClick?: (
    e: MouseEvent<HTMLDivElement>,
    messageRef: RefObject<HTMLDivElement>,
  ) => void;
  withButtons?: boolean;
}

const OVERLAY_ICON_SIZE = 18;
const MOBILE_ICON_SIZE = 20;
const DEFAULT_ICON_SIZE = 28;

export const ChatMessageContent = ({
  messageIndex,
  isLastMessage,
  message,
  conversation,
  onEdit,
  editDisabled,
  onLike,
  isLikesEnabled,
  onDelete,
  onClick,
  messageCopied,
  onCopy,
  isEditing,
  toggleEditing,
  isEditingTemplates,
  toggleEditingTemplates,
  withButtons,
  onRegenerate,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);
  const codeWarning = useAppSelector(SettingsSelectors.selectCodeWarning);
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  const messageRef = useRef<HTMLDivElement>(null);

  const isConversationInvalid = isEntityNameOrPathInvalid(conversation);

  const isAssistant = message.role === Role.Assistant;
  const isShowResponseLoader: boolean =
    !!conversation.isMessageStreaming && isLastMessage;
  const isUser = message.role === Role.User;

  const codeRegEx =
    /(?:(?:^|\n)[ \t]*`{3}[\s\S]*?(?:^|\n)[ \t]*`{3}|(?:^|\n)(?: {4}|\t)[^\n]*)/g;

  const codeDetection = (content: string) => content.match(codeRegEx);

  const chatIconSize = isOverlay
    ? OVERLAY_ICON_SIZE
    : isSmallScreen()
      ? MOBILE_ICON_SIZE
      : DEFAULT_ICON_SIZE;
  const isMobileOrOverlay = isSmallScreen() || isOverlay;

  return (
    <div
      ref={messageRef}
      className={classNames(
        'group h-full border-b border-secondary md:px-4 xl:px-8',
        isAssistant && 'bg-layer-2',
      )}
      style={{ overflowWrap: 'anywhere' }}
      data-qa="chat-message"
      onClick={(e) => {
        if (!conversation.isMessageStreaming) {
          onClick?.(e, messageRef);
        }
      }}
    >
      <div
        className={classNames(
          'm-auto flex h-full md:gap-6 md:py-6 lg:px-0',
          !isChatFullWidth && 'md:max-w-2xl xl:max-w-3xl',
          isMobileOrOverlay ? 'p-3' : 'p-4',
        )}
      >
        <div className="font-bold" data-qa="message-icon">
          <div
            className={classNames(
              'flex justify-center',
              isMobileOrOverlay ? 'mr-2.5' : 'mx-2.5',
            )}
          >
            {isAssistant ? (
              <ModelIcon
                entityId={message.model?.id ?? conversation.model.id}
                entity={
                  (message.model?.id && modelsMap[message.model?.id]) ||
                  undefined
                }
                animate={isShowResponseLoader}
                size={chatIconSize}
              />
            ) : (
              <IconUser size={chatIconSize} />
            )}
          </div>
        </div>

        <div
          className="mt-[-2px] w-full min-w-0 shrink"
          data-qa="message-content"
        >
          {isUser ? (
            <UserMessage
              message={message}
              conversation={conversation}
              messageIndex={messageIndex}
              isEditing={isEditing}
              isEditingTemplates={isEditingTemplates}
              isLastMessage={isLastMessage}
              toggleEditing={toggleEditing}
              toggleEditingTemplates={toggleEditingTemplates}
              withButtons={withButtons}
              editDisabled={editDisabled}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ) : (
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
                    <div className="text-xxs text-error">{t(codeWarning)}</div>
                  )}
                {!(
                  conversation.isMessageStreaming &&
                  conversation.playback?.isPlayback &&
                  isLastMessage
                ) && (
                  <MessageAttachments
                    attachments={message.custom_content?.attachments}
                  />
                )}
                <MessageSchema
                  isLastMessage={isLastMessage}
                  message={message}
                  messageIndex={messageIndex}
                  allMessages={conversation.messages}
                />
                <ErrorMessage error={message.errorMessage}></ErrorMessage>
              </div>
              {withButtons &&
                !(conversation.isMessageStreaming && isLastMessage) &&
                !isConversationInvalid && (
                  <MessageAssistantButtons
                    copyOnClick={() => onCopy?.()}
                    isLikesEnabled={isLikesEnabled}
                    message={message}
                    messageCopied={messageCopied}
                    onLike={(likeStatus) => onLike?.(likeStatus)}
                    onRegenerate={onRegenerate}
                  />
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

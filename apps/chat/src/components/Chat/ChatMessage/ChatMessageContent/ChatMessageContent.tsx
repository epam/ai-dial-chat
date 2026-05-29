import { IconUser } from '@tabler/icons-react';
import { MouseEvent, RefObject, useRef } from 'react';

import classNames from 'classnames';

import { isSmallScreen } from '@/src/utils/app/mobile';

import { Conversation } from '@/src/types/chat';

import { useAppSelector } from '@/src/store/hooks';
import {
  ModelsSelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { AssistantMessage } from '@/src/components/Chat/ChatMessage/ChatMessageContent/AssistantMessage';
import { UserMessage } from '@/src/components/Chat/ChatMessage/ChatMessageContent/UserMessage';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';

import {
  Feature,
  Message,
  Role,
  onLikeMessageHandler,
} from '@epam/ai-dial-shared';

interface Props {
  message: Message;
  messageIndex: number;
  realMessageIndex: number;
  conversation: Conversation;
  allMessages: Message[];
  isLikesEnabled: boolean;
  isEditing: boolean;
  isLastMessage: boolean;
  isEditingTemplates: boolean;
  messageCopied?: boolean;
  editDisabled?: boolean;
  withButtons?: boolean;
  onToggleEditing: (value: boolean) => void;
  onToggleEditingTemplates: (value: boolean) => void;
  onRegenerate?: () => void;
  onEdit?: (
    editedMessage: Message,
    index: number,
    conversationId: string,
  ) => void;
  onCopy?: () => void;
  onLike?: onLikeMessageHandler;
  onDelete?: () => void;
  onClick?: (
    e: MouseEvent<HTMLDivElement>,
    messageRef: RefObject<HTMLDivElement>,
  ) => void;
}

const OVERLAY_ICON_SIZE = 18;
const MOBILE_ICON_SIZE = 20;
const DEFAULT_ICON_SIZE = 28;

export function ChatMessageContent({
  messageIndex,
  realMessageIndex,
  isLastMessage,
  message,
  allMessages,
  conversation,
  editDisabled,
  isLikesEnabled,
  isEditing,
  isEditingTemplates,
  withButtons,
  onToggleEditing,
  onToggleEditingTemplates,
  onLike,
  onDelete,
  onClick,
  onEdit,
  onRegenerate,
}: Props) {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const isUserMessageAlignEndEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.UserMessageAlignEnd),
  );
  const messageRef = useRef<HTMLDivElement>(null);

  const isAssistant = message.role === Role.Assistant;
  const isShowResponseLoader: boolean =
    !!conversation.isMessageStreaming && isLastMessage;
  const isUser = message.role === Role.User;
  const alignUserMessageEnd =
    isUser && !isEditing && isUserMessageAlignEndEnabled;

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
        if (!conversation.isMessageStreaming && !!messageRef.current) {
          onClick?.(e, messageRef as RefObject<HTMLDivElement>);
        }
      }}
    >
      <div
        className={classNames(
          'm-auto flex h-full md:gap-6 md:py-6 lg:px-0',
          !isChatFullWidth && 'md:max-w-2xl xl:max-w-3xl',
          isMobileOrOverlay ? 'p-3' : 'p-4',
          alignUserMessageEnd && 'flex-row-reverse justify-end',
        )}
      >
        <div className="font-bold" data-qa="message-icon">
          <div
            className={classNames(
              'flex justify-center',
              alignUserMessageEnd
                ? 'ms-2.5'
                : isMobileOrOverlay
                  ? 'mr-2.5'
                  : 'mx-2.5',
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
          className={classNames(
            'mt-[-2px] w-full min-w-0 shrink',
            alignUserMessageEnd && 'text-end',
          )}
          data-qa="message-content"
        >
          {isUser ? (
            <UserMessage
              message={message}
              messageIndex={messageIndex}
              realMessageIndex={realMessageIndex}
              allMessages={allMessages}
              conversation={conversation}
              isEditing={isEditing}
              isEditingTemplates={isEditingTemplates}
              isAlignedToEnd={alignUserMessageEnd}
              withButtons={withButtons}
              editDisabled={editDisabled}
              onToggleEditing={onToggleEditing}
              onToggleEditingTemplates={onToggleEditingTemplates}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ) : (
            <AssistantMessage
              messageIndex={messageIndex}
              realMessageIndex={realMessageIndex}
              message={message}
              allMessages={allMessages}
              conversation={conversation}
              isEditing={isEditing}
              isLastMessage={isLastMessage}
              isLikesEnabled={isLikesEnabled}
              withButtons={withButtons}
              onLike={onLike}
              onToggleEditing={onToggleEditing}
              onEdit={onEdit}
              onRegenerate={onRegenerate}
            />
          )}
        </div>
      </div>
    </div>
  );
}

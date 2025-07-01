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

import { LikeState, Message, Role } from '@epam/ai-dial-shared';

interface Props {
  message: Message;
  messageIndex: number;
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
  onEdit?: (editedMessage: Message, index: number) => void;
  onCopy?: () => void;
  onLike?: (likeStatus: LikeState) => void;
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
  isLastMessage,
  message,
  allMessages,
  conversation,
  editDisabled,
  isLikesEnabled,
  messageCopied,
  isEditing,
  isEditingTemplates,
  withButtons,
  onToggleEditing,
  onToggleEditingTemplates,
  onLike,
  onDelete,
  onClick,
  onCopy,
  onEdit,
  onRegenerate,
}: Props) {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  const messageRef = useRef<HTMLDivElement>(null);

  const isAssistant = message.role === Role.Assistant;
  const isShowResponseLoader: boolean =
    !!conversation.isMessageStreaming && isLastMessage;
  const isUser = message.role === Role.User;

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
              allMessages={allMessages}
              conversation={conversation}
              messageIndex={messageIndex}
              isEditing={isEditing}
              isEditingTemplates={isEditingTemplates}
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
              message={message}
              conversation={conversation}
              isLastMessage={isLastMessage}
              isLikesEnabled={isLikesEnabled}
              withButtons={withButtons}
              messageCopied={messageCopied}
              onCopy={onCopy}
              onLike={onLike}
              onRegenerate={onRegenerate}
            />
          )}
        </div>
      </div>
    </div>
  );
}

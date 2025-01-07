import { memo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { isEntityNameOrPathInvalid } from '@/src/utils/app/common';

import { Conversation } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { MessageAssistantButtons } from '@/src/components/Chat/ChatMessage/MessageButtons';
import { AssistantSchema } from '@/src/components/Chat/ChatMessage/MessageSchema/MessageSchema';
import { MessageAttachments } from '@/src/components/Chat/MessageAttachments';
import { MessageStages } from '@/src/components/Chat/MessageStages';
import { ErrorMessage } from '@/src/components/Common/ErrorMessage';
import ChatMDComponent from '@/src/components/Markdown/ChatMDComponent';

import { LikeState, Message } from '@epam/ai-dial-shared';

interface AssistantMessageProps {
  message: Message;
  conversation: Conversation;
  isLastMessage: boolean;
  isLikesEnabled: boolean;
  withButtons?: boolean;
  messageCopied?: boolean;
  onCopy?: () => void;
  onLike?: (likeStatus: LikeState) => void;
  onRegenerate?: () => void;
}

export const AssistantMessage = memo(function AssistantMessage({
  message,
  conversation,
  isLastMessage,
  withButtons,
  onCopy,
  isLikesEnabled,
  messageCopied,
  onLike,
  onRegenerate,
}: AssistantMessageProps) {
  const { t } = useTranslation(Translation.Chat);

  const codeWarning = useAppSelector(SettingsSelectors.selectCodeWarning);

  const isShowResponseLoader =
    !!conversation.isMessageStreaming && isLastMessage;
  const isConversationInvalid = isEntityNameOrPathInvalid(conversation);

  const codeRegEx =
    /(?:(?:^|\n)[ \t]*`{3}[\s\S]*?(?:^|\n)[ \t]*`{3}|(?:^|\n)(?: {4}|\t)[^\n]*)/g;
  const codeDetection = (content: string) => content.match(codeRegEx);

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
        <AssistantSchema isLastMessage={isLastMessage} message={message} />
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
  );
});

import {
  IconCheck,
  IconCopy,
  IconEdit,
  IconThumbDown,
  IconThumbUp,
  IconTrash,
  IconUser,
} from '@tabler/icons-react';
import {
  ButtonHTMLAttributes,
  FC,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Conversation, Message, Role } from '@/src/types/chat';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import { ConfirmDialog } from '../Common/ConfirmDialog';
import { ErrorMessage } from '../Common/ErrorMessage';
import ChatMDComponent from '../Markdown/ChatMDComponent';
import { MessageAttachments } from './MessageAttachments';
import { MessageStages } from './MessageStages';

export interface Props {
  message: Message;
  messageIndex: number;
  conversation: Conversation;
  isLikesEnabled: boolean;
  editDisabled: boolean;
  onEdit: (editedMessage: Message, index: number) => void;
  onLike: (likeStatus: number) => void;
  onDelete: () => void;
}

const Button: FC<ButtonHTMLAttributes<HTMLButtonElement>> = ({
  children,
  className = 'invisible group-hover:visible',
  type = 'button',
  ...props
}) => {
  return (
    <button
      type={type}
      className={classNames(
        'text-gray-500 focus:visible [&:not(:disabled)]:hover:text-blue-500',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export const ChatMessage: FC<Props> = memo(
  ({
    message,
    messageIndex,
    conversation,
    isLikesEnabled,
    editDisabled,
    onEdit,
    onLike,
    onDelete,
  }) => {
    const { t } = useTranslation('chat');

    const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

    const theme = useAppSelector(UISelectors.selectThemeState);

    const codeWarning = useAppSelector(SettingsSelectors.selectCodeWarning);

    const isPlayback = useAppSelector(
      ConversationsSelectors.selectIsPlaybackSelectedConversations,
    );

    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [messageContent, setMessageContent] = useState(message.content);
    const [messagedCopied, setMessageCopied] = useState(false);
    const [isRemoveConfirmationOpened, setIsRemoveConfirmationOpened] =
      useState(false);

    const isLastMessage =
      messageIndex == (conversation?.messages.length ?? 0) - 1;

    const isShowResponseLoader: boolean =
      conversation.isMessageStreaming && isLastMessage;
    const isUser = message.role === Role.User;
    const isAssistant = message.role === Role.Assistant;

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const codeRegEx =
      /(?:(?:^|\n)[ \t]*`{3}[\s\S]*?(?:^|\n)[ \t]*`{3}|(?:^|\n)(?: {4}|\t)[^\n]*)/g;
    const codeDetection = (content: string) => content.match(codeRegEx);

    const toggleEditing = useCallback(() => {
      setIsEditing((val) => !val);
    }, []);

    const setLike = useCallback(
      (likeStatus: number) => () => {
        if (conversation && onLike) {
          onLike(likeStatus);
        }
      },
      [conversation, onLike],
    );

    const handleInputChange = useCallback(
      (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessageContent(event.target.value);
        if (textareaRef.current) {
          textareaRef.current.style.height = 'inherit';
          textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
      },
      [],
    );

    const handleEditMessage = useCallback(() => {
      if (message.content != messageContent) {
        if (conversation && onEdit) {
          onEdit({ ...message, content: messageContent }, messageIndex);
        }
      }
      setIsEditing(false);
    }, [conversation, message, messageContent, onEdit, messageIndex]);

    const handleDeleteMessage = useCallback(() => {
      onDelete();
    }, [onDelete]);

    const handlePressEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !isTyping && !e.shiftKey) {
        e.preventDefault();
        handleEditMessage();
      }
    };

    const copyOnClick = () => {
      if (!navigator.clipboard) return;

      navigator.clipboard.writeText(message.content).then(() => {
        setMessageCopied(true);
        setTimeout(() => {
          setMessageCopied(false);
        }, 2000);
      });
    };

    useEffect(() => {
      setMessageContent(message.content);
    }, [message.content]);

    useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'inherit';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }, [isEditing]);

    return (
      <div
        className={`group h-full min-h-[90px] md:px-4 ${
          isAssistant
            ? 'border-b border-gray-400 bg-gray-200 dark:border-gray-700 dark:bg-gray-800'
            : 'border-b border-gray-400  dark:border-gray-700'
        }`}
        style={{ overflowWrap: 'anywhere' }}
        data-qa="chat-message"
      >
        <div className="relative m-auto flex h-full p-4 md:max-w-2xl md:gap-6 md:py-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">
          <div className="min-w-[40px] font-bold" data-qa="message-icon">
            <div className="flex justify-center">
              {isAssistant ? (
                <ModelIcon
                  entityId={message.model?.id ?? conversation.model.id}
                  entity={
                    (message.model?.id && modelsMap[message.model?.id]) ||
                    undefined
                  }
                  inverted={theme === 'dark'}
                  animate={isShowResponseLoader}
                  size={28}
                />
              ) : (
                <IconUser size={30} />
              )}
            </div>
          </div>

          <div
            className="mt-[-2px] w-full min-w-0 shrink"
            data-qa="message-content"
          >
            {isUser ? (
              <div className="flex">
                {isEditing ? (
                  <div className="flex w-full flex-col gap-3 pr-[60px]">
                    <textarea
                      ref={textareaRef}
                      className="min-h-[100px] w-full resize-none whitespace-pre-wrap rounded border border-gray-400 px-3 py-2 focus-visible:border-blue-500 focus-visible:outline-none dark:border-gray-600 dark:bg-transparent"
                      value={messageContent}
                      onChange={handleInputChange}
                      onKeyDown={handlePressEnter}
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

                    <div className="flex justify-end gap-3">
                      <button
                        className="h-[38px] rounded border border-gray-400 px-3 py-2.5 leading-none hover:bg-gray-400 dark:border-gray-600 hover:dark:bg-gray-600"
                        onClick={() => {
                          setMessageContent(message.content);
                          setIsEditing(false);
                        }}
                        data-qa="cancel"
                      >
                        {t('Cancel')}
                      </button>
                      <button
                        className="h-[38px] rounded bg-blue-500 px-3 py-2.5 leading-none text-gray-100 hover:bg-blue-700 disabled:bg-gray-500"
                        onClick={handleEditMessage}
                        disabled={messageContent.trim().length <= 0}
                        data-qa="save-and-submit"
                      >
                        {t('Save & Submit')}
                      </button>
                    </div>
                  </div>
                ) : (
                  message.content && (
                    <div className="mr-2 flex w-full flex-col gap-5">
                      <div className="prose flex-1 whitespace-pre-wrap dark:prose-invert">
                        {message.content}
                      </div>
                      <MessageAttachments
                        attachments={message.custom_content?.attachments}
                      />
                    </div>
                  )
                )}

                {!isPlayback && !isEditing && (
                  <div className="flex w-[60px] flex-col items-center justify-end gap-4 md:flex-row md:items-start md:justify-start md:gap-1">
                    <button
                      className="invisible text-gray-500 hover:text-blue-500 focus:visible disabled:cursor-not-allowed group-hover:visible"
                      onClick={toggleEditing}
                      disabled={editDisabled}
                    >
                      <IconEdit size={20} />
                    </button>
                    <button
                      className="invisible text-gray-500 hover:text-blue-500 focus:visible group-hover:visible"
                      onClick={() => {
                        setIsRemoveConfirmationOpened(true);
                      }}
                    >
                      <IconTrash size={20} />
                    </button>

                    <ConfirmDialog
                      isOpen={isRemoveConfirmationOpened}
                      heading={t('Confirm removing message')}
                      description={
                        t(
                          'Are you sure that you want to remove the message?',
                        ) || ''
                      }
                      confirmLabel={t('Remove')}
                      cancelLabel={t('Cancel')}
                      onClose={(result) => {
                        setIsRemoveConfirmationOpened(false);
                        if (result) {
                          handleDeleteMessage();
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-full flex-row gap-1">
                <div className="flex min-w-0 shrink grow flex-col gap-4">
                  {!!message.custom_content?.stages?.length && (
                    <MessageStages stages={message.custom_content?.stages} />
                  )}
                  <ChatMDComponent
                    isShowResponseLoader={isShowResponseLoader}
                    content={message.content}
                  />
                  {codeWarning &&
                    codeWarning.length !== 0 &&
                    codeDetection(message.content) && (
                      <div className="text-xxs text-red-800 dark:text-red-400">
                        {t(codeWarning)}
                      </div>
                    )}
                  {!!message.custom_content?.attachments?.length && (
                    <MessageAttachments
                      attachments={message.custom_content.attachments}
                    />
                  )}
                  <ErrorMessage error={message.errorMessage}></ErrorMessage>
                </div>

                <div className="flex w-[60px] shrink-0 flex-col justify-between">
                  <div className="ml-1 flex flex-col items-center justify-end gap-4 md:-mr-8 md:ml-0 md:flex-row md:items-start md:justify-start md:gap-1">
                    {messagedCopied ? (
                      <IconCheck size={20} className="text-gray-500" />
                    ) : (
                      <Button onClick={copyOnClick}>
                        <IconCopy size={20} />
                      </Button>
                    )}
                  </div>
                  <div className="bottom-0 right-8 flex flex-row gap-2">
                    {isLikesEnabled && !!message.responseId && (
                      <>
                        {message.like !== -1 && (
                          <Button
                            onClick={message.like !== 1 ? setLike(1) : void 0}
                            className={
                              message.like !== 1
                                ? void 0
                                : 'visible text-gray-500'
                            }
                            disabled={message.like === 1}
                          >
                            <IconThumbUp size={24} />
                          </Button>
                        )}
                        {message.like !== 1 && (
                          <Button
                            onClick={message.like !== -1 ? setLike(-1) : void 0}
                            className={
                              message.like !== -1
                                ? void 0
                                : 'visible text-gray-500'
                            }
                            disabled={message.like === -1}
                          >
                            <IconThumbDown size={24} />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);
ChatMessage.displayName = 'ChatMessage';

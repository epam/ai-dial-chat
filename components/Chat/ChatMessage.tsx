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
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import { Conversation, Message } from '@/types/chat';

import HomeContext from '@/pages/api/home/home.context';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import ChatMDComponent from '../Markdown/ChatMDComponent';
import { MessageAttachments } from './MessageAttachments';
import { MessageError } from './MessageError';
import { MessageStages } from './MessageStages';

import classNames from 'classnames';

export interface Props {
  message: Message;
  messageIndex: number;
  conversation: Conversation;
  isLikesEnabled: boolean;
  editDisabled: boolean;
  onEdit: (editedMessage: Message) => void;
  onLike: (editedMessage: Message) => void;
  onDelete: (deletedMessage: Message) => void;
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
        'text-gray-500 hover:text-gray-700 focus:visible dark:text-gray-400 dark:hover:text-gray-300',
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

    const {
      state: { messageIsStreaming, modelIconMapping, lightMode },
    } = useContext(HomeContext);

    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [messageContent, setMessageContent] = useState(message.content);
    const [messagedCopied, setMessageCopied] = useState(false);

    const isLastMessage =
      messageIndex == (conversation?.messages.length ?? 0) - 1;

    const isShowResponseLoader: boolean = messageIsStreaming && isLastMessage;
    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const toggleEditing = () => {
      setIsEditing(!isEditing);
    };

    const setLike = (likeStatus: number) => () => {
      if (conversation && onLike) {
        onLike({ ...message, like: likeStatus });
      }
    };

    const handleInputChange = (
      event: React.ChangeEvent<HTMLTextAreaElement>,
    ) => {
      setMessageContent(event.target.value);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'inherit';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    };

    const handleEditMessage = () => {
      if (message.content != messageContent) {
        if (conversation && onEdit) {
          onEdit({ ...message, content: messageContent });
        }
      }
      setIsEditing(false);
    };

    const handleDeleteMessage = () => {
      onDelete(message);
    };

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
        className={`group h-full md:px-4 ${
          isAssistant
            ? 'border-b border-black/10 bg-gray-50 text-gray-800 dark:border-gray-900/50 dark:bg-[#444654] dark:text-gray-100'
            : 'border-b border-black/10 bg-white text-gray-800 dark:border-gray-900/50 dark:bg-[#343541] dark:text-gray-100'
        }`}
        style={{ overflowWrap: 'anywhere' }}
      >
        <div className="relative m-auto flex h-full p-4 text-base md:max-w-2xl md:gap-6 md:py-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">
          <div className="min-w-[40px] font-bold" data-qa="message-icon">
            {isAssistant ? (
              <ModelIcon
                modelIconMapping={modelIconMapping}
                modelId={message.model?.id ?? conversation.model.id}
                modelName={message.model?.name ?? conversation.model.name}
                inverted={lightMode === 'dark'}
                animate={isShowResponseLoader}
                size={24}
              />
            ) : (
              <IconUser size={30} />
            )}
          </div>

          <div className="mt-[-2px] w-full min-w-0 shrink" data-qa="message-content">
            {isUser ? (
              <div className="flex">
                {isEditing ? (
                  <div className="flex w-full flex-col">
                    <textarea
                      ref={textareaRef}
                      className="w-full resize-none whitespace-pre-wrap border-none dark:bg-[#343541]"
                      value={messageContent}
                      onChange={handleInputChange}
                      onKeyDown={handlePressEnter}
                      onCompositionStart={() => setIsTyping(true)}
                      onCompositionEnd={() => setIsTyping(false)}
                      style={{
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                        lineHeight: 'inherit',
                        padding: '0',
                        margin: '0',
                        overflow: 'hidden',
                      }}
                    />

                    <div className="mt-10 flex justify-center space-x-4">
                      <button
                        className="bg-blue-500 enabled:hover:bg-blue-600 h-[40px] rounded-md px-4 py-1 text-sm font-medium text-white disabled:opacity-50"
                        onClick={handleEditMessage}
                        disabled={messageContent.trim().length <= 0}
                      >
                        {t('Save & Submit')}
                      </button>
                      <button
                        className="h-[40px] rounded-md border border-neutral-300 px-4 py-1 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        onClick={() => {
                          setMessageContent(message.content);
                          setIsEditing(false);
                        }}
                      >
                        {t('Cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="prose flex-1 whitespace-pre-wrap dark:prose-invert">
                    {message.content}
                  </div>
                )}

                {!isEditing && (
                  <div className="flex w-[60px] flex-col items-center justify-end gap-4 md:flex-row md:items-start md:justify-start md:gap-1">
                    <button
                      className="invisible text-gray-500 hover:text-gray-700 focus:visible disabled:cursor-not-allowed group-hover:visible dark:text-gray-400 dark:hover:text-gray-300"
                      onClick={toggleEditing}
                      disabled={editDisabled}
                    >
                      <IconEdit size={20} />
                    </button>
                    <button
                      className="invisible text-gray-500 hover:text-gray-700 focus:visible group-hover:visible dark:text-gray-400 dark:hover:text-gray-300"
                      onClick={handleDeleteMessage}
                    >
                      <IconTrash size={20} />
                    </button>
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
                  {!!message.custom_content?.attachments?.length && (
                    <MessageAttachments
                      attachments={message.custom_content.attachments}
                    />
                  )}
                  {!!message.errorMessage && (
                    <MessageError error={message.errorMessage}></MessageError>
                  )}
                </div>

                <div className="flex w-[60px] shrink-0 flex-col justify-between">
                  <div className="ml-1 flex flex-col items-center justify-end gap-4 md:-mr-8 md:ml-0 md:flex-row md:items-start md:justify-start md:gap-1">
                    {messagedCopied ? (
                      <IconCheck
                        size={20}
                        className="text-green-500 dark:text-green-400"
                      />
                    ) : (
                      <Button onClick={copyOnClick}>
                        <IconCopy size={20} />
                      </Button>
                    )}
                  </div>
                  <div className="bottom-0 right-8 flex flex-row gap-2">
                    {isLikesEnabled && (
                      <>
                        {message.like !== -1 && (
                          <Button
                            onClick={message.like !== 1 ? setLike(1) : void 0}
                            className={
                              message.like !== 1
                                ? void 0
                                : 'visible text-gray-700 dark:text-gray-300'
                            }
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
                                : 'visible text-gray-700 dark:text-gray-300'
                            }
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

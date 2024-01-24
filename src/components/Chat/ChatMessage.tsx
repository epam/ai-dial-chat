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
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  getDialFilesFromAttachments,
  getUserCustomContent,
} from '@/src/utils/app/file';
import { isSmallScreen } from '@/src/utils/app/mobile';

import { Conversation, Message, Role } from '@/src/types/chat';
import { DialFile } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ModelIcon } from '../Chatbar/components/ModelIcon';
import Tooltip from '@/src/components/Common/Tooltip';

import { ConfirmDialog } from '../Common/ConfirmDialog';
import { ErrorMessage } from '../Common/ErrorMessage';
import { AttachButton } from '../Files/AttachButton';
import ChatMDComponent from '../Markdown/ChatMDComponent';
import { ChatInputAttachments } from './ChatInput/ChatInputAttachments';
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
        'text-secondary focus:visible [&:not(:disabled)]:hover:text-accent-primary',
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
    const { t } = useTranslation(Translation.Chat);
    const dispatch = useAppDispatch();

    const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
    const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);
    const codeWarning = useAppSelector(SettingsSelectors.selectCodeWarning);
    const isPlayback = useAppSelector(
      ConversationsSelectors.selectIsPlaybackSelectedConversations,
    );
    const isExternal = useAppSelector(
      ConversationsSelectors.selectAreSelectedConversationsExternal,
    );
    const isIframe = useAppSelector(SettingsSelectors.selectIsIframe);

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

    const mappedUserEditableAttachments = useMemo(() => {
      return getDialFilesFromAttachments(message.custom_content?.attachments);
    }, [message.custom_content?.attachments]);
    const mappedUserEditableAttachmentsIds = useMemo(() => {
      return mappedUserEditableAttachments.map(({ id }) => id);
    }, [mappedUserEditableAttachments]);

    const files = useAppSelector(FilesSelectors.selectFiles);

    const [newEditableAttachmentsIds, setNewEditableAttachmentsIds] = useState<
      string[]
    >(mappedUserEditableAttachmentsIds);
    const newEditableAttachments = useMemo(() => {
      const newIds = newEditableAttachmentsIds.filter(
        (id) => !mappedUserEditableAttachmentsIds.includes(id),
      );
      const newFiles = newIds
        .map((id) => files.find((file) => file.id === id))
        .filter(Boolean) as DialFile[];

      return mappedUserEditableAttachments
        .filter(({ id }) => newEditableAttachmentsIds.includes(id))
        .concat(newFiles);
    }, [
      files,
      mappedUserEditableAttachments,
      mappedUserEditableAttachmentsIds,
      newEditableAttachmentsIds,
    ]);

    const isSubmitAllowed = useMemo(() => {
      const isContentEmptyAndNoAttachments =
        messageContent.trim().length <= 0 && newEditableAttachments.length <= 0;
      const isUploadingAttachmentPresent = newEditableAttachments.some(
        (item) => item.status === 'UPLOADING',
      );

      return isContentEmptyAndNoAttachments || isUploadingAttachmentPresent;
    }, [messageContent, newEditableAttachments]);

    useEffect(() => {
      setNewEditableAttachmentsIds(mappedUserEditableAttachmentsIds);
    }, [mappedUserEditableAttachmentsIds]);

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
      },
      [],
    );

    const handleEditMessage = useCallback(() => {
      if (isSubmitAllowed) {
        return;
      }

      const isFinalAttachmentIdsSame =
        newEditableAttachmentsIds.length ===
          mappedUserEditableAttachmentsIds.length &&
        newEditableAttachmentsIds.every((id) =>
          mappedUserEditableAttachmentsIds.includes(id),
        );

      if (message.content != messageContent || !isFinalAttachmentIdsSame) {
        if (conversation && onEdit) {
          const attachments = getUserCustomContent(newEditableAttachments);

          onEdit(
            {
              ...message,
              content: messageContent,
              custom_content:
                message.custom_content?.attachments && !attachments
                  ? { attachments: [] }
                  : attachments,
            },
            messageIndex,
          );
        }
      }
      setIsEditing(false);
    }, [
      isSubmitAllowed,
      newEditableAttachmentsIds,
      mappedUserEditableAttachmentsIds,
      message,
      messageContent,
      conversation,
      onEdit,
      newEditableAttachments,
      messageIndex,
    ]);

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

    const handleUnselectFile = useCallback(
      (fileId: string) => {
        dispatch(FilesActions.uploadFileCancel({ id: fileId }));
        setNewEditableAttachmentsIds((ids) =>
          ids.filter((id) => id !== fileId),
        );
      },
      [dispatch],
    );

    const handleRetry = useCallback(
      (fileId: string) => {
        return () => dispatch(FilesActions.reuploadFile({ fileId }));
      },
      [dispatch],
    );
    const handleSelectAlreadyUploaded = useCallback((result: unknown) => {
      if (typeof result === 'object') {
        const selectedFilesIds = result as string[];
        const uniqueFilesIds = Array.from(new Set(selectedFilesIds));
        setNewEditableAttachmentsIds(uniqueFilesIds);
      }
    }, []);
    const handleUploadFromDevice = useCallback(
      (
        selectedFiles: Required<
          Pick<DialFile, 'fileContent' | 'id' | 'name'>
        >[],
        folderPath: string | undefined,
      ) => {
        selectedFiles.forEach((file) => {
          dispatch(
            FilesActions.uploadFile({
              fileContent: file.fileContent,
              id: file.id,
              relativePath: folderPath,
              name: file.name,
            }),
          );
        });

        setNewEditableAttachmentsIds((ids) =>
          Array.from(new Set(ids.concat(selectedFiles.map(({ id }) => id)))),
        );
      },
      [dispatch],
    );

    useEffect(() => {
      setMessageContent(message.content);
    }, [message.content]);

    useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'inherit';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }, [isEditing, messageContent]);

    return (
      <div
        className={classNames(
          'group h-full min-h-[78px] border-b border-secondary md:px-4 xl:px-8',
          isAssistant && 'bg-layer-2',
        )}
        style={{ overflowWrap: 'anywhere' }}
        data-qa="chat-message"
      >
        <div
          className={classNames(
            'relative m-auto flex h-full p-4 md:gap-6 md:py-6 lg:px-0',
            { 'md:max-w-2xl xl:max-w-3xl': !isChatFullWidth },
          )}
        >
          <div className="min-w-[40px] font-bold" data-qa="message-icon">
            <div className="flex justify-center">
              {isAssistant ? (
                <ModelIcon
                  entityId={message.model?.id ?? conversation.model.id}
                  entity={
                    (message.model?.id && modelsMap[message.model?.id]) ||
                    undefined
                  }
                  animate={isShowResponseLoader}
                  size={isIframe ? 18 : isSmallScreen() ? 20 : 28}
                />
              ) : (
                <IconUser size={isIframe ? 18 : isSmallScreen() ? 20 : 28} />
              )}
            </div>
          </div>

          <div
            className="mt-[-2px] w-full min-w-0 shrink leading-[150%]"
            data-qa="message-content"
          >
            {isUser ? (
              <div className="flex">
                {isEditing ? (
                  <div className="flex w-full flex-col gap-3 pr-[60px]">
                    <div className="relative min-h-[100px] rounded border border-primary bg-layer-3 px-3 py-2 focus-within:border-accent-primary">
                      <textarea
                        ref={textareaRef}
                        className="w-full grow resize-none whitespace-pre-wrap bg-transparent focus-visible:outline-none"
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

                      {newEditableAttachments.length > 0 && (
                        <div className="mb-2.5 grid max-h-[100px] grid-cols-1 gap-1 overflow-auto sm:grid-cols-2 md:grid-cols-3">
                          <ChatInputAttachments
                            files={newEditableAttachments}
                            onUnselectFile={handleUnselectFile}
                            onRetryFile={handleRetry}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex h-[34px] w-[34px] items-center justify-center rounded hover:bg-accent-primary-alpha">
                        <AttachButton
                          selectedFilesIds={newEditableAttachmentsIds}
                          onSelectAlreadyUploaded={handleSelectAlreadyUploaded}
                          onUploadFromDevice={handleUploadFromDevice}
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          className="button button-secondary"
                          onClick={() => {
                            setMessageContent(message.content);
                            setNewEditableAttachmentsIds(
                              mappedUserEditableAttachmentsIds,
                            );
                            setIsEditing(false);
                          }}
                          data-qa="cancel"
                        >
                          {t('Cancel')}
                        </button>
                        <button
                          className="button button-primary"
                          onClick={handleEditMessage}
                          disabled={isSubmitAllowed}
                          data-qa="save-and-submit"
                        >
                          {t('Save & Submit')}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mr-2 flex w-full flex-col gap-5">
                    {message.content && (
                      <div
                        className={classNames(
                          'prose flex-1 whitespace-pre-wrap md:leading-[150%]',
                          { 'max-w-none': isChatFullWidth },
                          { 'text-sm/[150%]': isIframe },
                        )}
                      >
                        {message.content}
                      </div>
                    )}
                    <MessageAttachments
                      attachments={message.custom_content?.attachments}
                    />
                  </div>
                )}

                {!isPlayback && !isEditing && !isExternal && (
                  <div className="flex w-[60px] flex-col items-center justify-end gap-4 md:flex-row md:items-start md:justify-start md:gap-1">
                    <button
                      className="invisible text-secondary hover:text-accent-primary focus:visible disabled:cursor-not-allowed group-hover:visible"
                      onClick={toggleEditing}
                      disabled={editDisabled}
                    >
                      <IconEdit size={20} />
                    </button>
                    <button
                      className="invisible text-secondary hover:text-accent-primary focus:visible group-hover:visible"
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
                <div
                  className={classNames(
                    'flex min-w-0 shrink grow flex-col',
                    (message.content || message.errorMessage) && 'gap-4',
                  )}
                >
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
                      <div className="text-xxs text-error">
                        {t(codeWarning)}
                      </div>
                    )}
                  <MessageAttachments
                    attachments={message.custom_content?.attachments}
                  />
                  <ErrorMessage error={message.errorMessage}></ErrorMessage>
                </div>

                <div className="flex w-[60px] shrink-0 flex-col justify-between">
                  <div className="ml-1 flex flex-col items-center justify-end gap-4 md:-mr-8 md:ml-0 md:flex-row md:items-start md:justify-start md:gap-1">
                    {messagedCopied ? (
                      <IconCheck size={20} className="text-secondary" />
                    ) : (
                      <Tooltip
                        placement="top"
                        isTriggerClickable
                        tooltip={t('Copy text')}
                      >
                        <Button onClick={copyOnClick}>
                          <IconCopy size={20} />
                        </Button>
                      </Tooltip>
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
                                : 'visible text-secondary'
                            }
                            disabled={message.like === 1}
                            data-qa="like"
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
                                : 'visible text-secondary'
                            }
                            disabled={message.like === -1}
                            data-qa="dislike"
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

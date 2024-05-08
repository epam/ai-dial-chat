import { IconPaperclip, IconUser } from '@tabler/icons-react';
import {
  MouseEvent,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { isEntityNameOrPathInvalid } from '@/src/utils/app/common';
import {
  getDialFilesFromAttachments,
  getDialLinksFromAttachments,
  getUserCustomContent,
} from '@/src/utils/app/file';
import { isSmallScreen } from '@/src/utils/app/mobile';

import { Conversation, LikeState, Message, Role } from '@/src/types/chat';
import { UploadStatus } from '@/src/types/common';
import { DialFile, DialLink } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ChatInputAttachments } from '@/src/components/Chat/ChatInput/ChatInputAttachments';
import {
  MessageAssistantButtons,
  MessageUserButtons,
} from '@/src/components/Chat/ChatMessage/MessageButtons';
import { MessageAttachments } from '@/src/components/Chat/MessageAttachments';
import { MessageStages } from '@/src/components/Chat/MessageStages';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { ErrorMessage } from '@/src/components/Common/ErrorMessage';
import { AttachButton } from '@/src/components/Files/AttachButton';
import ChatMDComponent from '@/src/components/Markdown/ChatMDComponent';

import { AdjustedTextarea } from './AdjustedTextarea';

import isEqual from 'lodash-es/isEqual';
import uniq from 'lodash-es/uniq';

export interface Props {
  message: Message;
  messageIndex: number;
  conversation: Conversation;
  isLikesEnabled: boolean;
  isEditing: boolean;
  isLastMessage: boolean;
  toggleEditing: (value: boolean) => void;
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
  withButtons,
  onRegenerate,
}: Props) => {
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
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const files = useAppSelector(FilesSelectors.selectFiles);
  const canAttachFiles = useAppSelector(
    ConversationsSelectors.selectCanAttachFile,
  );
  const canAttachLinks = useAppSelector(
    ConversationsSelectors.selectCanAttachLink,
  );

  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [messageContent, setMessageContent] = useState(message.content);
  const [shouldScroll, setShouldScroll] = useState(false);

  const anchorRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  const isConversationInvalid = isEntityNameOrPathInvalid(conversation);

  const isAssistant = message.role === Role.Assistant;
  const isShowResponseLoader: boolean =
    !!conversation.isMessageStreaming && isLastMessage;
  const isUser = message.role === Role.User;

  const codeRegEx =
    /(?:(?:^|\n)[ \t]*`{3}[\s\S]*?(?:^|\n)[ \t]*`{3}|(?:^|\n)(?: {4}|\t)[^\n]*)/g;

  const codeDetection = (content: string) => content.match(codeRegEx);

  const mappedUserEditableAttachments = useMemo(() => {
    return getDialFilesFromAttachments(message.custom_content?.attachments);
  }, [message.custom_content?.attachments]);
  const mappedUserEditableAttachmentsIds = useMemo(() => {
    return mappedUserEditableAttachments.map(({ id }) => id);
  }, [mappedUserEditableAttachments]);

  const [selectedDialLinks, setSelectedDialLinks] = useState<DialLink[]>([]);
  const [newEditableAttachmentsIds, setNewEditableAttachmentsIds] = useState<
    string[]
  >(mappedUserEditableAttachmentsIds);

  const handleAddLinkToMessage = useCallback((link: DialLink) => {
    setSelectedDialLinks((links) => links.concat([link]));
  }, []);
  const handleUnselectLink = useCallback((unselectedIndex: number) => {
    setSelectedDialLinks((links) =>
      links.filter((_link, index) => unselectedIndex !== index),
    );
  }, []);

  useEffect(() => {
    const links = getDialLinksFromAttachments(
      message.custom_content?.attachments,
    );
    setSelectedDialLinks(links);
  }, [message.custom_content?.attachments]);

  useEffect(() => {
    setNewEditableAttachmentsIds(mappedUserEditableAttachmentsIds);
  }, [mappedUserEditableAttachmentsIds]);

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
      (item) => item.status === UploadStatus.LOADING,
    );

    return isContentEmptyAndNoAttachments || isUploadingAttachmentPresent;
  }, [messageContent, newEditableAttachments]);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMessageContent(event.target.value);
    },
    [],
  );

  const handleToggleEditing = useCallback(
    (value?: boolean) => {
      toggleEditing(value ?? !isEditing);
      setShouldScroll(true);
    },
    [isEditing, toggleEditing],
  );

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

  const handleEditMessage = useCallback(() => {
    if (isSubmitAllowed) {
      return;
    }

    const attachments = getUserCustomContent(
      newEditableAttachments,
      selectedDialLinks,
    );
    const isAttachmentsSame = isEqual(
      message.custom_content?.attachments,
      attachments?.attachments,
    );

    if (message.content != messageContent || !isAttachmentsSame) {
      if (conversation && onEdit) {
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
        setSelectedDialLinks([]);
      }
    }
    handleToggleEditing(false);
  }, [
    isSubmitAllowed,
    message,
    messageContent,
    handleToggleEditing,
    conversation,
    onEdit,
    newEditableAttachments,
    selectedDialLinks,
    messageIndex,
  ]);

  useEffect(() => {
    setMessageContent(message.content);
  }, [message.content]);

  const handlePressEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !isTyping && !e.shiftKey) {
      e.preventDefault();
      handleEditMessage();
    }
  };

  const handleUnselectFile = useCallback(
    (fileId: string) => {
      dispatch(FilesActions.uploadFileCancel({ id: fileId }));
      setNewEditableAttachmentsIds((ids) => ids.filter((id) => id !== fileId));
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
      const uniqueFilesIds = uniq(selectedFilesIds);
      setNewEditableAttachmentsIds(uniqueFilesIds);
    }
  }, []);

  const handleUploadFromDevice = useCallback(
    (
      selectedFiles: Required<Pick<DialFile, 'fileContent' | 'id' | 'name'>>[],
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
        uniq(ids.concat(selectedFiles.map(({ id }) => id))),
      );
    },
    [dispatch],
  );

  const chatIconSize = isOverlay
    ? OVERLAY_ICON_SIZE
    : isSmallScreen()
      ? MOBILE_ICON_SIZE
      : DEFAULT_ICON_SIZE;
  const showUserButtons =
    !isPlayback && !isEditing && !isExternal && withButtons;
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
            isEditing ? (
              <div className="flex w-full flex-col gap-3">
                <div
                  className={classNames(
                    'relative min-h-[100px] rounded border border-primary bg-layer-3 px-3 py-2 focus-within:border-accent-primary',
                    !isOverlay && 'text-base',
                  )}
                >
                  <AdjustedTextarea
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

                  {(newEditableAttachments.length > 0 ||
                    selectedDialLinks.length > 0) && (
                    <div className="mb-2.5 grid max-h-[100px] grid-cols-1 gap-1 overflow-auto sm:grid-cols-2 md:grid-cols-3">
                      <ChatInputAttachments
                        files={newEditableAttachments}
                        links={selectedDialLinks}
                        onUnselectFile={handleUnselectFile}
                        onRetryFile={handleRetry}
                        onUnselectLink={handleUnselectLink}
                      />
                    </div>
                  )}
                </div>

                <div
                  className={classNames(
                    'flex items-center',
                    !canAttachFiles && !canAttachLinks
                      ? 'justify-end'
                      : 'justify-between',
                  )}
                >
                  <div className="size-[34px]">
                    <AttachButton
                      contextMenuPlacement="bottom-start"
                      TriggerCustomRenderer={
                        <div className="flex size-[34px] cursor-pointer items-center justify-center rounded hover:bg-accent-primary-alpha">
                          <IconPaperclip
                            strokeWidth="1.5"
                            size={24}
                            width={24}
                            height={24}
                          />
                        </div>
                      }
                      selectedFilesIds={newEditableAttachmentsIds}
                      onSelectAlreadyUploaded={handleSelectAlreadyUploaded}
                      onUploadFromDevice={handleUploadFromDevice}
                      onAddLinkToMessage={handleAddLinkToMessage}
                    />
                  </div>
                  <div className="relative flex gap-3">
                    <button
                      className="button button-secondary"
                      onClick={() => {
                        setMessageContent(message.content);
                        setNewEditableAttachmentsIds(
                          mappedUserEditableAttachmentsIds,
                        );
                        handleToggleEditing(false);
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
                    <div ref={anchorRef} className="absolute bottom-0"></div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="relative mr-2 flex w-full flex-col gap-5">
                  {message.content && (
                    <div
                      className={classNames(
                        'prose min-w-full flex-1 whitespace-pre-wrap',
                        {
                          'max-w-none': isChatFullWidth,
                          'text-sm': isOverlay,
                          'leading-[150%]': isMobileOrOverlay,
                        },
                      )}
                    >
                      {message.content}
                    </div>
                  )}
                  <MessageAttachments
                    attachments={message.custom_content?.attachments}
                  />
                  <div
                    ref={anchorRef}
                    className="absolute bottom-[-140px]"
                  ></div>
                </div>
                {showUserButtons && !isConversationInvalid && (
                  <MessageUserButtons
                    isMessageStreaming={!!conversation.isMessageStreaming}
                    isEditAvailable={!!onEdit}
                    editDisabled={editDisabled}
                    onDelete={() => onDelete?.()}
                    toggleEditing={handleToggleEditing}
                  />
                )}
              </>
            )
          ) : (
            <>
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
                    <div className="text-xxs text-error">{t(codeWarning)}</div>
                  )}
                {!(
                  conversation.isMessageStreaming &&
                  conversation.playback?.isPlayback
                ) && (
                  <MessageAttachments
                    attachments={message.custom_content?.attachments}
                  />
                )}
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

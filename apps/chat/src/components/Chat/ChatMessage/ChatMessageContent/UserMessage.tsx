import { IconPaperclip } from '@tabler/icons-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { isEntityNameOrPathInvalid } from '@/src/utils/app/common';
import {
  getDialFilesFromAttachments,
  getDialFoldersFromAttachments,
  getDialLinksFromAttachments,
  getUserCustomContent,
} from '@/src/utils/app/file';
import {
  getConfigurationSchema,
  getConfigurationValue,
  getMessageFormValue,
  isMessageInputDisabled,
} from '@/src/utils/app/form-schema';
import { isFolderId } from '@/src/utils/app/id';
import { isSmallScreen } from '@/src/utils/app/mobile';
import { getEntitiesFromTemplateMapping } from '@/src/utils/app/prompts';
import { ApiUtils } from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { DialFile, DialLink, FileFolderInterface } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { FOLDER_ATTACHMENT_CONTENT_TYPE } from '@/src/constants/folders';

import { ChatInputAttachments } from '@/src/components/Chat/ChatInput/ChatInputAttachments';
import { AdjustedTextarea } from '@/src/components/Chat/ChatMessage/AdjustedTextarea';
import { MessageUserButtons } from '@/src/components/Chat/ChatMessage/MessageButtons';
import { UserSchema } from '@/src/components/Chat/ChatMessage/MessageSchema/MessageSchema';
import { MessageAttachments } from '@/src/components/Chat/MessageAttachments';
import { AttachButton } from '@/src/components/Files/AttachButton';

import {
  Feature,
  Message,
  MessageFormValue,
  UploadStatus,
} from '@epam/ai-dial-shared';
import isEqual from 'lodash-es/isEqual';
import uniq from 'lodash-es/uniq';

interface UserMessageProps {
  message: Message;
  conversation: Conversation;
  messageIndex: number;
  allMessages: Message[];
  isEditing: boolean;
  isEditingTemplates: boolean;
  toggleEditing: (value: boolean) => void;
  toggleEditingTemplates: (value: boolean) => void;
  withButtons?: boolean;
  editDisabled?: boolean;
  onEdit?: (editedMessage: Message, index: number) => void;
  onDelete?: () => void;
}

export const UserMessage = memo(function UserMessage({
  message,
  conversation,
  messageIndex,
  allMessages,
  isEditing,
  isEditingTemplates,
  toggleEditing,
  toggleEditingTemplates,
  withButtons,
  editDisabled,
  onEdit,
  onDelete,
}: UserMessageProps) {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const anchorRef = useRef<HTMLDivElement>(null);

  const isReplay = useAppSelector(
    ConversationsSelectors.selectIsReplaySelectedConversations,
  );
  const isExternal = useAppSelector(
    ConversationsSelectors.selectAreSelectedConversationsExternal,
  );
  const isPlayback = useAppSelector(
    ConversationsSelectors.selectIsPlaybackSelectedConversations,
  );
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const canAttachFolders = useAppSelector(
    ConversationsSelectors.selectCanAttachFolders,
  );
  const files = useAppSelector(FilesSelectors.selectFiles);
  const folders = useAppSelector(FilesSelectors.selectFolders);
  const canAttachFiles = useAppSelector(
    ConversationsSelectors.selectCanAttachFile,
  );
  const canAttachLinks = useAppSelector(
    ConversationsSelectors.selectCanAttachLink,
  );
  const isMessageTemplatesEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.MessageTemplates),
  );
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);

  const isMobileOrOverlay = isSmallScreen() || isOverlay;
  const isInputDisabled = isMessageInputDisabled(messageIndex, allMessages);

  const currentFormValue = useMemo(
    () => getMessageFormValue(message) ?? getConfigurationValue(message),
    [message],
  );

  const [messageContent, setMessageContent] = useState(message.content);
  const [formValue, setFormValue] = useState(currentFormValue);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [selectedDialLinks, setSelectedDialLinks] = useState<DialLink[]>([]);

  const showUserButtons =
    !isReplay && !isPlayback && !isEditing && !isExternal && withButtons;

  const isConversationInvalid = isEntityNameOrPathInvalid(conversation);

  const mappedUserEditableAttachments = useMemo(() => {
    return [
      ...(getDialFoldersFromAttachments(
        message.custom_content?.attachments,
      ) as unknown as Omit<DialFile, 'contentLength'>[]),
      ...getDialFilesFromAttachments(message.custom_content?.attachments),
    ];
  }, [message.custom_content?.attachments]);

  const mappedUserEditableAttachmentsIds = useMemo(() => {
    return mappedUserEditableAttachments.map(({ id }) => id);
  }, [mappedUserEditableAttachments]);

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

    const newFolders = newIds
      .map(
        (id) => canAttachFolders && folders.find((folder) => folder.id === id),
      )
      .filter(Boolean)
      .map((folder) => ({
        ...folder,
        contentType: FOLDER_ATTACHMENT_CONTENT_TYPE,
      })) as DialFile[];

    return mappedUserEditableAttachments
      .filter(({ id }) => newEditableAttachmentsIds.includes(id))
      .concat(newFiles)
      .concat(newFolders);
  }, [
    canAttachFolders,
    files,
    folders,
    mappedUserEditableAttachments,
    mappedUserEditableAttachmentsIds,
    newEditableAttachmentsIds,
  ]);

  const fileAttachments = useMemo(
    () =>
      newEditableAttachments.filter(
        (f) => f.contentType !== FOLDER_ATTACHMENT_CONTENT_TYPE,
      ),
    [newEditableAttachments],
  );

  const folderAttachments = useMemo(
    () =>
      canAttachFolders
        ? (newEditableAttachments.filter(
            (f) => f.contentType === FOLDER_ATTACHMENT_CONTENT_TYPE,
          ) as unknown as FileFolderInterface[])
        : undefined,
    [canAttachFolders, newEditableAttachments],
  );

  const isUploadingAttachmentPresent = useMemo(
    () =>
      newEditableAttachments.some(
        (item) => item.status === UploadStatus.LOADING,
      ),
    [newEditableAttachments],
  );

  const isContentEmptyAndNoAttachments = useMemo(
    () =>
      messageContent.trim().length <= 0 && newEditableAttachments.length <= 0,
    [messageContent, newEditableAttachments],
  );

  const selectedFileIds = useMemo(
    () =>
      newEditableAttachments.map((f) =>
        f.contentType === FOLDER_ATTACHMENT_CONTENT_TYPE
          ? ApiUtils.decodeApiUrl(f.id).replace(new RegExp('^metadata/'), '') +
            '/'
          : f.id,
      ),
    [newEditableAttachments],
  );

  const isInputHidden =
    isInputDisabled &&
    !messageContent &&
    !newEditableAttachments.length &&
    !selectedDialLinks.length;

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

  const handleAddLinkToMessage = useCallback((link: DialLink) => {
    setSelectedDialLinks((links) => links.concat([link]));
  }, []);

  const handleUnselectLink = useCallback((unselectedIndex: number) => {
    setSelectedDialLinks((links) =>
      links.filter((_link, index) => unselectedIndex !== index),
    );
  }, []);

  const handleEditMessage = useCallback(
    (formValue?: MessageFormValue, newContent?: string) => {
      const attachments = getUserCustomContent(
        newEditableAttachments.filter(
          (a) =>
            !(a as unknown as FolderInterface).type &&
            a.contentType !== FOLDER_ATTACHMENT_CONTENT_TYPE,
        ),
        newEditableAttachments.filter(
          (a) =>
            !!(a as unknown as FolderInterface).type ||
            a.contentType === FOLDER_ATTACHMENT_CONTENT_TYPE,
        ) as unknown as FolderInterface[],
        selectedDialLinks,
      );
      const isAttachmentsSame = isEqual(
        message.custom_content?.attachments,
        attachments?.attachments,
      );
      const isFormValueChanged = !isEqual(
        getMessageFormValue(message) ?? getConfigurationValue(message),
        formValue,
      );
      const isContentChanged =
        message.content !== (newContent ?? messageContent);

      if (isContentChanged || !isAttachmentsSame || isFormValueChanged) {
        if (conversation && onEdit) {
          onEdit(
            {
              ...message,
              content: newContent ?? messageContent,
              custom_content: {
                attachments:
                  message.custom_content?.attachments && !attachments
                    ? []
                    : attachments?.attachments,
                ...(formValue &&
                  (getConfigurationSchema(message)
                    ? {
                        configuration_value: formValue,
                        configuration_schema: getConfigurationSchema(message),
                      }
                    : {
                        form_value: formValue,
                      })),
              },
              templateMapping: getEntitiesFromTemplateMapping(
                message.templateMapping,
              ).filter(([key]) => messageContent.includes(key)),
            },
            messageIndex,
          );
          setSelectedDialLinks([]);
        }
      }
      handleToggleEditing(false);
    },
    [
      message,
      messageContent,
      handleToggleEditing,
      conversation,
      onEdit,
      newEditableAttachments,
      selectedDialLinks,
      messageIndex,
    ],
  );

  const handlePressEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !isTyping && !e.shiftKey) {
      e.preventDefault();
      handleEditMessage(formValue, messageContent);
    }
  };

  const handleUnselectFile = useCallback(
    (fileId: string) => {
      dispatch(FilesActions.uploadFileCancel({ id: fileId }));
      const fid = isFolderId(fileId) ? fileId.slice(0, -1) : fileId;
      setNewEditableAttachmentsIds((ids) => ids.filter((id) => id !== fid));
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
      setNewEditableAttachmentsIds(
        uniqueFilesIds.map((id) => (isFolderId(id) ? id.slice(0, -1) : id)),
      );
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

  const handleToggleEditingTemplates = useCallback(
    (value?: boolean) => {
      toggleEditingTemplates(value ?? !isEditingTemplates);
    },
    [isEditingTemplates, toggleEditingTemplates],
  );

  useEffect(() => {
    setMessageContent(message.content);
  }, [message.content]);

  useEffect(() => {
    setFormValue(currentFormValue);
  }, [currentFormValue, isEditing]);

  useEffect(() => {
    const links = getDialLinksFromAttachments(
      message.custom_content?.attachments,
    );
    setSelectedDialLinks(links);
  }, [message.custom_content?.attachments]);

  useEffect(() => {
    setNewEditableAttachmentsIds(mappedUserEditableAttachmentsIds);
  }, [mappedUserEditableAttachmentsIds]);

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
        <UserSchema
          messageIndex={messageIndex}
          allMessages={allMessages}
          isEditing={isEditing}
          setInputValue={setMessageContent}
          onSubmit={handleEditMessage}
          disabled={isUploadingAttachmentPresent}
          formValue={formValue}
          setFormValue={setFormValue}
        />

        {!isInputHidden && (
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

            {(newEditableAttachments.length > 0 ||
              selectedDialLinks.length > 0) && (
              <div
                className="mb-2.5 grid max-h-[100px] grid-cols-1 gap-1 overflow-auto sm:grid-cols-2 md:grid-cols-3"
                data-qa="attachment-container"
              >
                <ChatInputAttachments
                  files={fileAttachments}
                  folders={folderAttachments}
                  links={selectedDialLinks}
                  onUnselectFile={handleUnselectFile}
                  onRetryFile={handleRetry}
                  onUnselectLink={handleUnselectLink}
                />
              </div>
            )}
          </div>
        )}

        <div
          className={classNames(
            'flex items-center',
            !canAttachFiles && !canAttachFolders && !canAttachLinks
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
              selectedFilesIds={selectedFileIds}
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
                setNewEditableAttachmentsIds(mappedUserEditableAttachmentsIds);
                handleToggleEditing(false);
              }}
              data-qa="cancel"
            >
              {t('Cancel')}
            </button>
            {!isInputHidden && (
              <button
                className="button button-primary"
                onClick={() => handleEditMessage(formValue, messageContent)}
                disabled={
                  isUploadingAttachmentPresent || isContentEmptyAndNoAttachments
                }
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
      <div className="relative mr-2 flex w-full flex-col gap-5">
        <UserSchema
          formValue={currentFormValue}
          messageIndex={messageIndex}
          allMessages={allMessages}
          isEditing={isEditing}
        />
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
        <MessageAttachments attachments={message.custom_content?.attachments} />
        <div ref={anchorRef} className="absolute bottom-[-140px]"></div>
      </div>
      {showUserButtons && !isConversationInvalid && (
        <MessageUserButtons
          isMessageStreaming={!!conversation.isMessageStreaming}
          isEditAvailable={!!onEdit}
          editDisabled={editDisabled}
          onDelete={() => onDelete?.()}
          toggleEditing={handleToggleEditing}
          isEditTemplatesAvailable={!isExternal && isMessageTemplatesEnabled}
          onToggleTemplatesEditing={handleToggleEditingTemplates}
        />
      )}
    </>
  );
});

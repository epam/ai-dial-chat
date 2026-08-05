import { IconPaperclip } from '@tabler/icons-react';
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import classNames from 'classnames';

import { useChatUploadFiles } from '@/src/hooks/useChatUploadFiles';
import { useFilePaste } from '@/src/hooks/useFilePaste';
import { useTextareaInsertInPosition } from '@/src/hooks/useTextareaInsertInPosition';
import { useTranslation } from '@/src/hooks/useTranslation';
import { useVoiceRecorder } from '@/src/hooks/useVoiceRecorder';

import {
  getTranscriptTextToInsert,
  isEntityNameOrPathInvalid,
  replaceStringRange,
} from '@/src/utils/app/common';
import {
  getDialFilesFromAttachments,
  getDialFoldersFromAttachments,
  getDialLinksFromAttachments,
  getUserCustomContent,
} from '@/src/utils/app/file';
import { dispatchRetryFileUpload } from '@/src/utils/app/file-upload-dispatch';
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

import { ChatActions, FilesActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ChatSelectors,
  ConversationsSelectors,
  FilesSelectors,
  PublicationSelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { FOLDER_ATTACHMENT_CONTENT_TYPE } from '@/src/constants/folders';
import { ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { ChatInputAttachments } from '@/src/components/Chat/ChatInput/ChatInputAttachments';
import { MicrophoneButton } from '@/src/components/Chat/ChatInput/MicrophoneButton';
import { TranscribingOverlay } from '@/src/components/Chat/ChatInput/TranscribingOverlay';
import { VoiceRecordingOverlay } from '@/src/components/Chat/ChatInput/VoiceRecordingOverlay';
import { AdjustedTextarea } from '@/src/components/Chat/ChatMessage/AdjustedTextarea';
import { MessageUserButtons } from '@/src/components/Chat/ChatMessage/MessageButtons';
import { UserSchema } from '@/src/components/Chat/ChatMessage/MessageSchema/MessageSchema';
import { MessageAttachments } from '@/src/components/Chat/MessageAttachments';
import { AttachButton } from '@/src/components/Files/AttachButton';
import { FileDropArea } from '@/src/components/Files/FileDropArea';

import { OverlayMessageCustomButtons } from './OverlayMessageCustomButtons';
import {
  getSaveSubmitTooltipText,
  isSaveSubmitTooltipHidden,
} from './saveSubmitTooltip';

import {
  Feature,
  Message,
  MessageFormValue,
  Role,
  UploadStatus,
} from '@epam/ai-dial-shared';
import { DialNeutralButton, DialPrimaryButton } from '@epam/ai-dial-ui-kit';
import isEqual from 'lodash-es/isEqual';
import uniq from 'lodash-es/uniq';

interface UserMessageProps {
  message: Message;
  conversation: Conversation;
  messageIndex: number;
  realMessageIndex: number;
  allMessages: Message[];
  isEditing: boolean;
  isEditingTemplates: boolean;
  isAlignedToEnd?: boolean;
  withButtons?: boolean;
  editDisabled?: boolean;
  onToggleEditing: (value: boolean) => void;
  onToggleEditingTemplates: (value: boolean) => void;
  onEdit?: (
    editedMessage: Message,
    index: number,
    conversationId: string,
  ) => void;
  onDelete?: () => void;
}

export const UserMessage = memo(function UserMessage({
  message,
  conversation,
  messageIndex,
  realMessageIndex,
  allMessages,
  isEditing,
  isEditingTemplates,
  isAlignedToEnd,
  withButtons,
  editDisabled,
  onToggleEditing,
  onToggleEditingTemplates,
  onEdit,
  onDelete,
}: UserMessageProps) {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const anchorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isReplay = useAppSelector(
    ConversationsSelectors.selectIsReplaySelectedConversations,
  );
  const isReadOnly = useAppSelector(
    ConversationsSelectors.selectAreSelectedConversationsReadOnly,
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
  const canRecordAudio = useAppSelector(
    ConversationsSelectors.selectCanRecordAudio,
  );
  const isAsrMode = useAppSelector(ConversationsSelectors.selectIsAsrMode);
  const supportedAudioTypes = useAppSelector(
    ConversationsSelectors.selectSupportedAudioRecordingTypes,
  );
  const userMessageTranscript = useAppSelector(
    ChatSelectors.selectUserMessageTranscript,
  );
  const userMessageVoiceAttachmentId = useAppSelector(
    ChatSelectors.selectUserMessageVoiceAttachmentId,
  );
  const isUserMessageTranscribing = useAppSelector(
    ChatSelectors.selectIsUserMessageTranscribing,
  );
  const isMessageTemplatesEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.MessageTemplates),
  );
  const isApproveRequiredEntitySelected = useAppSelector((state) =>
    PublicationSelectors.selectIsApproveRequiredEntitySelected(
      state,
      conversation.id,
    ),
  );
  const isExternalChat = useAppSelector(
    ConversationsSelectors.selectAreSelectedConversationsExternal,
  );

  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);

  const isMobileOrOverlay = isSmallScreen() || isOverlay;
  const isInputDisabled = isMessageInputDisabled(messageIndex, allMessages);

  const currentFormValue = useMemo(
    () => getMessageFormValue(message) ?? getConfigurationValue(message),
    [message],
  );

  const [messageContent, setMessageContent] = useState(message.content);
  const { insertTextAtCursor } = useTextareaInsertInPosition(
    textareaRef,
    messageContent,
    setMessageContent,
  );
  const [formValue, setFormValue] = useState(currentFormValue);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [selectedDialLinks, setSelectedDialLinks] = useState<DialLink[]>([]);
  const micButtonRef = useRef<HTMLButtonElement>(null);

  const showUserButtons =
    (!isReplay && !isPlayback && !isEditing && withButtons && !isReadOnly) ||
    (isApproveRequiredEntitySelected &&
      !isReplay &&
      !isPlayback &&
      withButtons);
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

  const mappedUserDialLinks = useMemo(
    () => getDialLinksFromAttachments(message.custom_content?.attachments),
    [message.custom_content?.attachments],
  );

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

  const isDialLinksChanged = useMemo(
    () => !isEqual(mappedUserDialLinks, selectedDialLinks),
    [mappedUserDialLinks, selectedDialLinks],
  );

  const isContentEmptyAndNoAttachments = useMemo(
    () =>
      messageContent.trim().length <= 0 &&
      newEditableAttachments.length <= 0 &&
      !isDialLinksChanged,
    [messageContent, newEditableAttachments, isDialLinksChanged],
  );

  const selectedFileIds = useMemo(
    () =>
      newEditableAttachments.map((f) =>
        f.contentType === FOLDER_ATTACHMENT_CONTENT_TYPE
          ? ApiUtils.decodeApiUrl(f.id).replace(new RegExp('^metadata/'), '') +
            '/'
          : ApiUtils.decodeApiUrl(f.id),
      ),
    [newEditableAttachments],
  );

  const isInputHidden =
    isInputDisabled &&
    !messageContent &&
    !newEditableAttachments.length &&
    !selectedDialLinks.length;

  const {
    isRecording,
    startRecording,
    stopRecording,
    audioBlob,
    analyserNode,
    error: voiceError,
    elapsedTime,
    fileExtension: voiceFileExtension,
    clearAudioBlob,
  } = useVoiceRecorder(supportedAudioTypes);

  const isMicDisabled = useMemo(
    () =>
      isInputDisabled ||
      isReplay ||
      isPlayback ||
      isReadOnly ||
      isUploadingAttachmentPresent ||
      isUserMessageTranscribing ||
      (isAsrMode && !!conversation.isMessageStreaming),
    [
      isInputDisabled,
      isReplay,
      isPlayback,
      isReadOnly,
      isUploadingAttachmentPresent,
      isUserMessageTranscribing,
      isAsrMode,
      conversation.isMessageStreaming,
    ],
  );

  const textareaRightPaddingClass = canRecordAudio
    ? isOverlay
      ? 'pr-[60px]'
      : 'pr-[72px]'
    : '';

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
            conversation.id,
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

  const allowEnterClick = useAppSelector(UISelectors.selectAllowEnterToSend);

  const handlePressEnter = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!isTyping && allowEnterClick(e)) {
        e.preventDefault();
        handleEditMessage(formValue, messageContent);
      }
    },
    [allowEnterClick, formValue, handleEditMessage, isTyping, messageContent],
  );

  const handleUnselectFile = useCallback(
    (fileId: string) => {
      const fid = isFolderId(fileId) ? fileId.slice(0, -1) : fileId;
      const file = files.find((f) => f.id === fid);
      if (file?.isFromDeviceAttachment) {
        dispatch(FilesActions.deleteFile({ fileId: fid }));
      } else {
        dispatch(FilesActions.uploadFileCancel({ id: fileId }));
      }
      setNewEditableAttachmentsIds((ids) => ids.filter((id) => id !== fid));
    },
    [dispatch, files],
  );

  const handleRetry = useCallback(
    (fileId: string) => {
      dispatchRetryFileUpload(dispatch, fileId);
    },
    [dispatch],
  );

  const handleSelectAlreadyUploaded = useCallback((result: string[]) => {
    const uniqueFilesIds = uniq(result);
    setNewEditableAttachmentsIds(
      uniqueFilesIds.map((id) => (isFolderId(id) ? id.slice(0, -1) : id)),
    );
  }, []);

  const { uploadFiles: uploadPastedFiles } = useChatUploadFiles({
    selectedAttachmentsAmount: newEditableAttachments.length,
    skipSelect: true,
  });

  const handleToggleEditingTemplates = useCallback(
    (value?: boolean) => {
      onToggleEditingTemplates(value ?? !isEditingTemplates);
    },
    [isEditingTemplates, onToggleEditingTemplates],
  );

  const deleteHandler = useMemo(() => {
    if (!isExternalChat) {
      return onDelete;
    }

    const userMessagesCount = allMessages.filter(
      (m) => m.role === Role.User,
    ).length;

    if (userMessagesCount <= 1 && !isApproveRequiredEntitySelected) {
      return undefined;
    }

    return onDelete;
  }, [allMessages, isExternalChat, isApproveRequiredEntitySelected, onDelete]);

  const handleStopRecording = useCallback(() => {
    // To show the transcribing overlay when the user stops recording
    if (isAsrMode) {
      dispatch(ChatActions.startUserMessageTranscription());
    }
    stopRecording();
  }, [isAsrMode, stopRecording, dispatch]);

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

  useEffect(() => {
    if (!isEditing && isRecording) {
      stopRecording();
    }
  }, [isEditing, isRecording, stopRecording]);

  useEffect(() => {
    if (!audioBlob) {
      return;
    }

    if (!isEditing) {
      clearAudioBlob();
      return;
    }
    dispatch(
      ChatActions.handleUserMessageVoiceRecording({
        audioBlob,
        fileExtension: voiceFileExtension,
      }),
    );
    clearAudioBlob();
  }, [audioBlob, isEditing, voiceFileExtension, dispatch, clearAudioBlob]);

  useEffect(() => {
    if (!userMessageTranscript) {
      return;
    }

    const textarea = textareaRef.current;

    if (textarea) {
      const beforeCursor = messageContent.substring(0, textarea.selectionStart);
      const textToInsert = getTranscriptTextToInsert(
        beforeCursor,
        userMessageTranscript,
      );

      if (textToInsert) {
        insertTextAtCursor(textToInsert);
      }
    } else {
      const trimmedTranscript = userMessageTranscript.trim();
      if (trimmedTranscript) {
        setMessageContent((prev) =>
          prev.trim() ? `${prev} ${trimmedTranscript}` : trimmedTranscript,
        );
      }
    }

    dispatch(ChatActions.clearUserMessageTranscript());
  }, [dispatch, insertTextAtCursor, messageContent, userMessageTranscript]);

  useEffect(() => {
    if (!userMessageVoiceAttachmentId) {
      return;
    }

    setNewEditableAttachmentsIds((ids) =>
      uniq(ids.concat(userMessageVoiceAttachmentId)),
    );
    dispatch(ChatActions.clearUserMessageVoiceAttachmentId());
  }, [dispatch, userMessageVoiceAttachmentId]);

  useEffect(() => {
    if (!isEditing) {
      dispatch(ChatActions.clearUserMessageTranscript());
      dispatch(ChatActions.clearUserMessageVoiceAttachmentId());
    }
  }, [dispatch, isEditing]);

  const resolvedUploadIds = useAppSelector(
    FilesSelectors.selectResolvedUploadIds,
  );

  useEffect(() => {
    if (!resolvedUploadIds?.length) return;
    if (isEditing) {
      setNewEditableAttachmentsIds((ids) =>
        uniq(ids.concat(resolvedUploadIds)),
      );
    }
    dispatch(FilesActions.clearResolvedUploadIds());
  }, [resolvedUploadIds, isEditing, dispatch]);

  const handleUploadPastedFiles = useCallback(
    (
      files: File[],
      textContent?: string,
      selection?: { start: number; end: number },
    ) => {
      if (textContent) {
        setMessageContent((prev) =>
          selection
            ? replaceStringRange(
                prev,
                textContent,
                selection.start,
                selection.end,
              )
            : textContent,
        );
      } else if (canAttachFiles) {
        uploadPastedFiles(files)?.then((newFiles) => {
          setNewEditableAttachmentsIds((ids) =>
            uniq(ids.concat(newFiles.map(({ id }) => id))),
          );
        });
      }
    },
    [uploadPastedFiles, canAttachFiles],
  );

  useFilePaste(textareaRef, handleUploadPastedFiles);

  const handleDropWhileEditing = useCallback(() => {
    // Do nothing - prevent files from being dropped while editing
  }, []);

  if (isEditing)
    return (
      <FileDropArea
        droppable={false}
        onDrop={handleDropWhileEditing}
        className="w-full"
        id="edit-message-file-drop-area"
      >
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
                ref={textareaRef}
                className={classNames(
                  'w-full grow resize-none whitespace-pre-wrap bg-transparent focus-visible:outline-none',
                  textareaRightPaddingClass,
                )}
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
              {isRecording && (
                <VoiceRecordingOverlay
                  analyserNode={analyserNode}
                  elapsedTime={elapsedTime}
                  isOverlay={isOverlay}
                />
              )}
              {isUserMessageTranscribing && (
                <TranscribingOverlay text={t(ChatI18nKeys.TranscribingAudio)} />
              )}
              {canRecordAudio && (
                <MicrophoneButton
                  ref={micButtonRef}
                  isRecording={isRecording}
                  onStartRecording={startRecording}
                  onStopRecording={handleStopRecording}
                  error={voiceError}
                  disabled={isMicDisabled}
                />
              )}

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
                      size={DEFAULT_ICON_SIZES.STANDARD}
                      width={DEFAULT_ICON_SIZES.STANDARD}
                      height={DEFAULT_ICON_SIZES.STANDARD}
                    />
                  </div>
                }
                selectedFilesIds={selectedFileIds}
                onSelectAlreadyUploaded={handleSelectAlreadyUploaded}
                onAddLinkToMessage={handleAddLinkToMessage}
              />
            </div>

            <div className="relative flex gap-3">
              <DialNeutralButton
                label={t(ChatI18nKeys.Cancel)}
                onClick={() => {
                  setMessageContent(message.content);
                  setNewEditableAttachmentsIds(
                    mappedUserEditableAttachmentsIds,
                  );
                  setSelectedDialLinks(
                    getDialLinksFromAttachments(
                      message.custom_content?.attachments,
                    ),
                  );
                  if (isRecording) {
                    stopRecording();
                  }
                  handleToggleEditing(false);
                }}
                data-qa="cancel"
              />
              {!isInputHidden && (
                <DialPrimaryButton
                  label={t(ChatI18nKeys.SaveAndSubmit)}
                  onClick={() => handleEditMessage(formValue, messageContent)}
                  disabled={
                    isUploadingAttachmentPresent ||
                    isContentEmptyAndNoAttachments ||
                    isUserMessageTranscribing
                  }
                  tooltipProps={{
                    hideTooltip: isSaveSubmitTooltipHidden({
                      isUploadingAttachmentPresent,
                      isContentEmptyAndNoAttachments,
                      isTranscribing: isUserMessageTranscribing,
                    }),
                    tooltip: getSaveSubmitTooltipText(
                      {
                        isUploadingAttachmentPresent,
                        isContentEmptyAndNoAttachments,
                        isTranscribing: isUserMessageTranscribing,
                      },
                      t,
                    ),
                    isTriggerClickable: true,
                  }}
                  data-qa="save-and-submit"
                />
              )}
              <div ref={anchorRef} className="absolute bottom-0"></div>
            </div>
          </div>
        </div>
      </FileDropArea>
    );

  return (
    <>
      <div
        className={classNames('relative flex w-full flex-col gap-5', {
          'me-2': isAlignedToEnd,
          'mr-2': !isAlignedToEnd,
        })}
      >
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

        {isOverlay && (
          <OverlayMessageCustomButtons realMessageIndex={realMessageIndex} />
        )}

        <div
          ref={anchorRef}
          className="absolute bottom-[-140px] select-none"
        ></div>
      </div>
      {showUserButtons && !isConversationInvalid && (
        <MessageUserButtons
          realMessageIndex={realMessageIndex}
          isMessageStreaming={!!conversation.isMessageStreaming}
          isEditAvailable={!!onEdit && !editDisabled}
          onDelete={deleteHandler}
          onToggleEditing={handleToggleEditing}
          isEditTemplatesAvailable={
            (!isReadOnly || isApproveRequiredEntitySelected) &&
            isMessageTemplatesEnabled
          }
          onToggleTemplatesEditing={handleToggleEditingTemplates}
        />
      )}
    </>
  );
});

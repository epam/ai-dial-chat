import { IconPaperclip } from '@tabler/icons-react';
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { isSafari } from 'react-device-detect';

import classNames from 'classnames';

import { useChatUploadFiles } from '@/src/hooks/useChatUploadFiles';
import { useFilePaste } from '@/src/hooks/useFilePaste';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  isEntityNameOrPathInvalid,
  replaceStringRange,
} from '@/src/utils/app/common';
import { isPlaybackConversation } from '@/src/utils/app/conversation';
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
import { isEntityReadOnly } from '@/src/utils/app/permissions';
import { getEntitiesFromTemplateMapping } from '@/src/utils/app/prompts';
import { ResolvedUploadFile } from '@/src/utils/app/prepare-files-for-upload';
import { ApiUtils } from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { DialFile, DialLink, FileFolderInterface } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';
import { Translation } from '@/src/types/translation';

import { FilesActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
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
import { MessageAssistantButtons } from '@/src/components/Chat/ChatMessage/MessageButtons';
import { AssistantSchema } from '@/src/components/Chat/ChatMessage/MessageSchema/MessageSchema';
import { MessageAttachments } from '@/src/components/Chat/MessageAttachments';
import { MessageStages } from '@/src/components/Chat/MessageStages';
import { ErrorMessage } from '@/src/components/Common/ErrorMessage';
import { AttachButton } from '@/src/components/Files/AttachButton';
import { ChatMDComponent } from '@/src/components/Markdown/ChatMDComponent';

import { AdjustedTextarea } from '../AdjustedTextarea';
import { OverlayMessageCustomButtons } from './OverlayMessageCustomButtons';
import {
  getSaveSubmitTooltipText,
  isSaveSubmitTooltipHidden,
} from './saveSubmitTooltip';

import {
  ConversationResponseFormat,
  Feature,
  Message,
  MessageFormValue,
  UploadStatus,
  onLikeMessageHandler,
} from '@epam/ai-dial-shared';
import { DialNeutralButton, DialPrimaryButton } from '@epam/ai-dial-ui-kit';
import isEqual from 'lodash-es/isEqual';
import uniq from 'lodash-es/uniq';
import throttle from 'lodash/throttle';

const SAFARI_THROTTLE_TIMEOUT = 100;

interface AssistantMessageEditorProps {
  messageIndex: number;
  message: Message;
  allMessages: Message[];
  conversation: Conversation;
  isLastMessage: boolean;
  shouldScroll: boolean;
  onToggleEditing: (value: boolean) => void;
  onSetShouldScroll: (value: boolean) => void;
  onEdit?: (
    editedMessage: Message,
    index: number,
    conversationId: string,
  ) => void;
}

const AssistantMessageEditor = memo(function AssistantMessageEditor({
  messageIndex,
  message,
  allMessages,
  conversation,
  isLastMessage,
  shouldScroll,
  onSetShouldScroll,
  onToggleEditing,
  onEdit,
}: AssistantMessageEditorProps) {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const currentFormValue = useMemo(
    () => getMessageFormValue(message) ?? getConfigurationValue(message),
    [message],
  );

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const files = useAppSelector(FilesSelectors.selectFiles);
  const folders = useAppSelector(FilesSelectors.selectFolders);
  const canAttachFolders = useAppSelector(
    ConversationsSelectors.selectCanAttachFolders,
  );
  const canAttachFiles = useAppSelector(
    ConversationsSelectors.selectCanAttachFile,
  );
  const canAttachLinks = useAppSelector(
    ConversationsSelectors.selectCanAttachLink,
  );

  const anchorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [messageContent, setMessageContent] = useState(message.content);
  const [formValue, setFormValue] = useState(currentFormValue);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [selectedDialLinks, setSelectedDialLinks] = useState<DialLink[]>([]);

  const mappedEditableAttachments = useMemo(() => {
    return [
      ...(getDialFoldersFromAttachments(
        message.custom_content?.attachments,
      ) as unknown as Omit<DialFile, 'contentLength'>[]),
      ...getDialFilesFromAttachments(message.custom_content?.attachments),
    ];
  }, [message.custom_content?.attachments]);

  const mappedEditableAttachmentsIds = useMemo(() => {
    return mappedEditableAttachments.map(({ id }) => id);
  }, [mappedEditableAttachments]);

  const [newEditableAttachmentsIds, setNewEditableAttachmentsIds] = useState<
    string[]
  >(mappedEditableAttachmentsIds);

  const newEditableAttachments = useMemo(() => {
    const newIds = newEditableAttachmentsIds.filter(
      (id) => !mappedEditableAttachmentsIds.includes(id),
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

    return mappedEditableAttachments
      .filter(({ id }) => newEditableAttachmentsIds.includes(id))
      .concat(newFiles)
      .concat(newFolders);
  }, [
    canAttachFolders,
    files,
    folders,
    mappedEditableAttachments,
    mappedEditableAttachmentsIds,
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
          : ApiUtils.decodeApiUrl(f.id),
      ),
    [newEditableAttachments],
  );

  const isInputDisabled = isMessageInputDisabled(messageIndex, allMessages);
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

  const handleEditMessage = useCallback(
    (formValueArg?: MessageFormValue, newContent?: string) => {
      if (!conversation || !onEdit) return;

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
        formValueArg,
      );
      const isContentChanged =
        message.content !== (newContent ?? messageContent);

      if (isContentChanged || !isAttachmentsSame || isFormValueChanged) {
        onEdit(
          {
            ...message,
            content: newContent ?? messageContent,
            custom_content: {
              ...message.custom_content,
              attachments:
                message.custom_content?.attachments && !attachments
                  ? []
                  : attachments?.attachments,
              ...(formValueArg &&
                (getConfigurationSchema(message)
                  ? {
                      configuration_value: formValueArg,
                      configuration_schema: getConfigurationSchema(message),
                    }
                  : {
                      form_value: formValueArg,
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
      onToggleEditing(false);
    },
    [
      message,
      messageContent,
      newEditableAttachments,
      onToggleEditing,
      conversation,
      onEdit,
      messageIndex,
      selectedDialLinks,
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

  const handleCancelEditing = useCallback(() => {
    setMessageContent(message.content);
    setNewEditableAttachmentsIds(mappedEditableAttachmentsIds);
    const links = getDialLinksFromAttachments(
      message.custom_content?.attachments,
    );
    setSelectedDialLinks(links);
    onToggleEditing(false);
  }, [
    mappedEditableAttachmentsIds,
    message.content,
    message.custom_content?.attachments,
    onToggleEditing,
  ]);

  const handleAddLinkToMessage = useCallback((link: DialLink) => {
    setSelectedDialLinks((links) => links.concat([link]));
  }, []);

  const handleUnselectLink = useCallback((unselectedIndex: number) => {
    setSelectedDialLinks((links) =>
      links.filter((_link, index) => unselectedIndex !== index),
    );
  }, []);

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
      return () => dispatch(FilesActions.reuploadFile({ fileId }));
    },
    [dispatch],
  );

  const handleSelectAlreadyUploaded = useCallback((result: string[]) => {
    const uniqueFilesIds = uniq(result);
    setNewEditableAttachmentsIds(
      uniqueFilesIds.map((id) => (isFolderId(id) ? id.slice(0, -1) : id)),
    );
  }, []);

  const { uploadFiles: uploadPastedFiles, dispatchPreparedFiles } =
    useChatUploadFiles({
      selectedAttachmentsAmount: newEditableAttachments.length,
      skipSelect: true,
    });

  const handleUploadFromDevice = useCallback(
    (
      selectedFiles: ResolvedUploadFile[],
      folderPath: string | undefined,
    ) => {
      const ids = dispatchPreparedFiles(selectedFiles, folderPath, {
        isFromDeviceAttachment: true,
      });

      setNewEditableAttachmentsIds((prevIds) => uniq(prevIds.concat(ids)));
    },
    [dispatchPreparedFiles],
  );

  const handleUploadPastedFiles = useCallback(
    (
      pasteFiles: File[],
      textContent?: string,
      selection?: { start: number; end: number },
    ) => {
      if (canAttachFiles) {
        uploadPastedFiles(pasteFiles)?.then((newFiles) => {
          setNewEditableAttachmentsIds((ids) =>
            uniq(ids.concat(newFiles.map(({ id }) => id))),
          );
        });
      }
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
      }
    },
    [uploadPastedFiles, canAttachFiles],
  );

  useFilePaste(textareaRef, handleUploadPastedFiles);

  useEffect(() => {
    setMessageContent(message.content);
    setFormValue(currentFormValue);
    onSetShouldScroll(true);
  }, [currentFormValue, message.content, onSetShouldScroll]);

  useEffect(() => {
    const links = getDialLinksFromAttachments(
      message.custom_content?.attachments,
    );
    setSelectedDialLinks(links);
  }, [message.custom_content?.attachments]);

  useEffect(() => {
    setNewEditableAttachmentsIds(mappedEditableAttachmentsIds);
  }, [mappedEditableAttachmentsIds]);

  useEffect(() => {
    if (shouldScroll) {
      anchorRef.current?.scrollIntoView({ block: 'end' });
      onSetShouldScroll(false);
    }
  }, [shouldScroll, onSetShouldScroll]);

  return (
    <div className="flex w-full flex-col gap-3">
      <AssistantSchema message={message} isLastMessage={isLastMessage} />

      {!isInputHidden && (
        <div
          className={classNames(
            'relative min-h-[100px] rounded border border-primary bg-layer-3 px-3 py-2 focus-within:border-accent-primary',
            !isOverlay && 'text-base',
          )}
        >
          <AdjustedTextarea
            ref={textareaRef}
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
                  size={DEFAULT_ICON_SIZES.STANDARD}
                  width={DEFAULT_ICON_SIZES.STANDARD}
                  height={DEFAULT_ICON_SIZES.STANDARD}
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
          <DialNeutralButton
            label={t(ChatI18nKeys.Cancel)}
            onClick={handleCancelEditing}
            data-qa="cancel"
          />

          {!isInputHidden && (
            <DialPrimaryButton
              label={t(ChatI18nKeys.SaveAndSubmit)}
              onClick={() => handleEditMessage(formValue, messageContent)}
              disabled={
                isUploadingAttachmentPresent || isContentEmptyAndNoAttachments
              }
              tooltipProps={{
                hideTooltip: isSaveSubmitTooltipHidden({
                  isUploadingAttachmentPresent,
                  isContentEmptyAndNoAttachments,
                }),
                tooltip: getSaveSubmitTooltipText(
                  {
                    isUploadingAttachmentPresent,
                    isContentEmptyAndNoAttachments,
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
  );
});

interface AssistantMessageProps {
  messageIndex: number;
  realMessageIndex: number;
  message: Message;
  allMessages: Message[];
  conversation: Conversation;
  isLastMessage: boolean;
  isLikesEnabled: boolean;
  isEditing: boolean;
  withButtons?: boolean;
  onLike?: onLikeMessageHandler;
  onRegenerate?: () => void;
  onToggleEditing: (value: boolean) => void;
  onEdit?: (
    editedMessage: Message,
    index: number,
    conversationId: string,
  ) => void;
}

export const AssistantMessage = memo(function AssistantMessage({
  messageIndex,
  realMessageIndex,
  message,
  allMessages,
  conversation,
  isLastMessage,
  isEditing,
  withButtons,
  isLikesEnabled,
  onLike,
  onRegenerate,
  onToggleEditing,
  onEdit,
}: AssistantMessageProps) {
  const { t } = useTranslation(Translation.Chat);

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const resourcesToReview = useAppSelector(
    PublicationSelectors.selectResourcesToReview,
  );
  const codeWarning = useAppSelector(SettingsSelectors.selectCodeWarning);
  const isEditLastMessageEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.EditLastAssistantContent),
  );
  const isAllLastMessageEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.EditAllAssistantContent),
  );

  const [shouldScroll, setShouldScroll] = useState(false);

  const isShowResponseLoader =
    !!conversation.isMessageStreaming && isLastMessage;
  const isConversationInvalid = isEntityNameOrPathInvalid(conversation);

  const isReadOnlyConversation = isEntityReadOnly(conversation);
  const isPublishingConversation = useMemo(
    () => !!resourcesToReview.find((r) => r.reviewUrl === conversation.id),
    [conversation.id, resourcesToReview],
  );

  const [throttledContent, setThrottledContent] = useState(message.content);

  const updateContent = useMemo(
    () =>
      throttle((content: string) => {
        setThrottledContent(content);
      }, SAFARI_THROTTLE_TIMEOUT),
    [],
  );

  useEffect(() => {
    if (!isSafari) return;

    if (isShowResponseLoader) {
      updateContent(message.content);
    } else {
      updateContent.cancel();
      setThrottledContent(message.content);
    }
  }, [isShowResponseLoader, message.content, updateContent]);

  const codeRegEx =
    /(?:(?:^|\n)[ \t]*`{3}[\s\S]*?(?:^|\n)[ \t]*`{3}|(?:^|\n)(?: {4}|\t)[^\n]*)/g;
  const codeDetection = (content: string) => content.match(codeRegEx);

  const handleToggleEditing = useCallback(
    (value?: boolean) => {
      onToggleEditing(value ?? !isEditing);
      setShouldScroll(true);
    },
    [isEditing, onToggleEditing],
  );

  if (isEditing) {
    return (
      <AssistantMessageEditor
        shouldScroll={shouldScroll}
        onSetShouldScroll={setShouldScroll}
        messageIndex={messageIndex}
        message={message}
        allMessages={allMessages}
        conversation={conversation}
        isLastMessage={isLastMessage}
        onToggleEditing={onToggleEditing}
        onEdit={onEdit}
      />
    );
  }

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
            content={isSafari ? throttledContent : message.content}
            plainTextMode={
              conversation.responseFormat ===
              ConversationResponseFormat.PlainText
            }
          />
        )}
        {codeWarning &&
          codeWarning.length !== 0 &&
          codeDetection(message.content) && (
            <div className="select-none text-xxs text-error">
              {t(codeWarning)}
            </div>
          )}
        {!(
          conversation.isMessageStreaming &&
          isPlaybackConversation(conversation) &&
          isLastMessage
        ) && (
          <MessageAttachments
            attachments={message.custom_content?.attachments}
            applicationId={message.model?.id}
            annotations={message.custom_fields?.annotations}
          />
        )}
        <AssistantSchema isLastMessage={isLastMessage} message={message} />
        <ErrorMessage error={message.errorMessage}></ErrorMessage>

        {isOverlay && (
          <OverlayMessageCustomButtons realMessageIndex={realMessageIndex} />
        )}
      </div>
      {withButtons &&
        (!conversation.isMessageStreaming || !isLastMessage) &&
        !isConversationInvalid && (
          <MessageAssistantButtons
            isLikesEnabled={isLikesEnabled}
            message={message}
            realMessageIndex={realMessageIndex}
            onLike={onLike}
            onRegenerate={onRegenerate}
            onToggleEditing={
              !isPlaybackConversation(conversation) &&
              (isAllLastMessageEnabled ||
                (isLastMessage && isEditLastMessageEnabled)) &&
              (!isReadOnlyConversation || isPublishingConversation)
                ? handleToggleEditing
                : undefined
            }
          />
        )}
    </>
  );
});

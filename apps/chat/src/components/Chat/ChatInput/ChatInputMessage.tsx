import React, {
  KeyboardEvent,
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import classNames from 'classnames';

import { usePromptSelection } from '@/src/hooks/usePromptSelection';
import { useTokenizer } from '@/src/hooks/useTokenizer';
import { useTranslation } from '@/src/hooks/useTranslation';
import { useVoiceRecorder } from '@/src/hooks/useVoiceRecorder';

import { addTrailingSlashIfAbsent } from '@/src/utils/app/common';
import { getUserCustomContent } from '@/src/utils/app/file';
import {
  getConversationSchema,
  isFormValueValid,
} from '@/src/utils/app/form-schema';
import { getPromptLimitDescription } from '@/src/utils/app/modals';

import { DialFile, DialLink } from '@/src/types/files';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import {
  ChatActions,
  ConversationsActions,
  FilesActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ChatEventsSelectors,
  ChatSelectors,
  ConversationsSelectors,
  FilesSelectors,
  ModelsSelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { errorsMessages } from '@/src/constants/errors';
import { ChatI18nKeys } from '@/src/constants/i18n';

import { ChatControls } from '@/src/components/Chat/ChatInput/ChatControls';
import { AdjustedTextarea } from '@/src/components/Chat/ChatMessage/AdjustedTextarea';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { ScrollDownButton } from '@/src/components/Common/ScrollDownButton';
import { AttachButton } from '@/src/components/Files/AttachButton';

import { ChatInputAttachments } from './ChatInputAttachments';
import { MicrophoneButton } from './MicrophoneButton';
import { PromptList } from './PromptList';
import { PromptVariablesDialog } from './PromptVariablesDialog';
import { ReplayVariables } from './ReplayVariables';
import { VoiceRecordingOverlay } from './VoiceRecordingOverlay';

import { Inversify } from '@epam/ai-dial-modulify-ui';
import { Feature, Message, Role } from '@epam/ai-dial-shared';

interface Props {
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  showScrollDownButton: boolean;
  onScrollDownClick: () => void;
  onSend: (message: Message) => void;
  onStopConversation: () => void;
  isLastMessageError: boolean;
  onRegenerate: () => void;
  showReplayControls: boolean;
  isPreview?: boolean;
}

const MAX_HEIGHT = 320;

export const ChatInputMessage = Inversify.register(
  'ChatInputMessage',
  ({
    textareaRef,
    showScrollDownButton,
    onScrollDownClick,
    onSend,
    onStopConversation,
    onRegenerate,
    isLastMessageError,
    isPreview,
    showReplayControls,
  }: Props) => {
    const { t } = useTranslation(Translation.Chat);

    const dispatch = useAppDispatch();

    const [isTyping, setIsTyping] = useState(false);
    const [showPluginSelect, setShowPluginSelect] = useState(false);
    const [selectedDialLinks, setSelectedDialLinks] = useState<DialLink[]>([]);

    const promptTemplateMappingRef = useRef(new Map<string, string>());
    const prevStreamingRef = useRef(false);
    const micButtonRef = useRef<HTMLButtonElement>(null);

    const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
    const messageIsStreaming = useAppSelector(
      ConversationsSelectors.selectIsConversationsStreaming,
    );
    const selectedConversations = useAppSelector(
      ConversationsSelectors.selectSelectedConversations,
    );
    const isConversationNameInvalid = useAppSelector(
      ConversationsSelectors.selectIsConversationNameInvalid,
    );
    const isConversationPathInvalid = useAppSelector(
      ConversationsSelectors.selectIsConversationPathInvalid,
    );
    const isReplay = useAppSelector(
      ConversationsSelectors.selectIsReplaySelectedConversations,
    );
    const canAttachFiles = useAppSelector(
      ConversationsSelectors.selectCanAttachFile,
    );
    const canAttachFolders = useAppSelector(
      ConversationsSelectors.selectCanAttachFolders,
    );
    const canAttachLinks = useAppSelector(
      ConversationsSelectors.selectCanAttachLink,
    );
    const maximumAttachmentsAmount = useAppSelector(
      ConversationsSelectors.selectMaximumAttachmentsAmount,
    );
    const selectedFiles = useAppSelector(FilesSelectors.selectSelectedFiles);
    const selectedFolders = useAppSelector(
      FilesSelectors.selectSelectedFolders,
    );
    const isUploadingFilePresent = useAppSelector(
      FilesSelectors.selectIsUploadingFilePresent,
    );
    const isMessageError = useAppSelector(
      ConversationsSelectors.selectIsMessagesError,
    );
    const isLastAssistantMessageEmpty = useAppSelector(
      ConversationsSelectors.selectIsLastAssistantMessageEmpty,
    );
    const areModelsLoaded = useAppSelector(
      ModelsSelectors.selectAreModelsLoaded,
    );
    const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);
    const chatFormValue = useAppSelector(ChatSelectors.selectChatFormValue);
    const selectedModels = useAppSelector(
      ConversationsSelectors.selectSelectedConversationsModels,
    );
    const isChatInputDisabled = useAppSelector(
      ConversationsSelectors.selectIsSelectedConversationBlocksInput,
    );
    const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

    const configurationSchema = useAppSelector((state) =>
      ChatSelectors.selectConfigurationSchemaByModelId(
        state,
        selectedConversations[0]?.model.id,
        modelsMap,
      ),
    );

    const shouldFocusAndScroll = useAppSelector(
      ChatSelectors.selectShouldFocusAndScroll,
    );
    const inputContentTemplateMapping = useAppSelector(
      ChatSelectors.selectInputContentTemplateMapping,
    );
    const isDisabledInputFeature = useAppSelector((state) =>
      SettingsSelectors.isFeatureEnabled(state, Feature.DisabledSend),
    );
    const disabledInputFeatureData = useAppSelector((state) =>
      SettingsSelectors.selectFeatureData(state, Feature.DisabledSend),
    );
    const isChatInputBorderEnabled = useAppSelector((state) =>
      SettingsSelectors.isFeatureEnabled(state, Feature.ChatInputBorder),
    );

    const canRecordAudio = useAppSelector(
      ConversationsSelectors.selectCanRecordAudio,
    );
    const isAsrMode = useAppSelector(ConversationsSelectors.selectIsAsrMode);
    const isTranscribing = useAppSelector(ChatSelectors.selectIsTranscribing);
    const isAsrFlowActive = useAppSelector(ChatSelectors.selectIsAsrFlowActive);
    const supportedAudioTypes = useAppSelector(
      ConversationsSelectors.selectSupportedAudioRecordingTypes,
    );
    const isChatEventsEnabled = useAppSelector((state) =>
      SettingsSelectors.isFeatureEnabled(state, Feature.LiveChatInteraction),
    );
    const _isSubscribing = useAppSelector(
      ChatEventsSelectors.selectIsSubscribing,
    );

    const isSubscribing = isChatEventsEnabled && _isSubscribing;

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

    useEffect(() => {
      if (!audioBlob) return;

      dispatch(
        ChatActions.handleVoiceRecording({
          audioBlob,
          fileExtension: voiceFileExtension,
        }),
      );
      clearAudioBlob();
    }, [audioBlob, voiceFileExtension, dispatch, clearAudioBlob]);

    const shouldRegenerate =
      isLastMessageError ||
      (isLastAssistantMessageEmpty && !messageIsStreaming);

    useEffect(() => {
      if (shouldFocusAndScroll && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.scrollIntoView();
        dispatch(ChatActions.setShouldFocusAndScroll(false));
      }
    }, [dispatch, shouldFocusAndScroll, textareaRef]);

    useEffect(() => {
      if (!canAttachLinks) {
        setSelectedDialLinks([]);
      }
      if (!canAttachFiles || !canAttachFolders) {
        dispatch(
          FilesActions.resetSelectedFiles({
            keepFiles: canAttachFiles,
            keepFolders: canAttachFolders,
          }),
        );
      }
    }, [canAttachFiles, canAttachFolders, canAttachLinks, dispatch]);

    useEffect(() => {
      if (inputContentTemplateMapping) {
        promptTemplateMappingRef.current.set(
          inputContentTemplateMapping.substituted.trim(),
          inputContentTemplateMapping.original.trim(),
        );
        dispatch(ChatActions.clearInputContentTemplateMapping());
      }
    }, [dispatch, inputContentTemplateMapping]);

    const isChatEmpty = !selectedConversations[0]?.messages?.length;

    const modelTokenizer =
      selectedModels?.length === 1 ? selectedModels[0]?.tokenizer : undefined;
    const maxTokensLength =
      selectedModels.length === 1
        ? (selectedModels[0]?.limits?.maxRequestTokens ?? Infinity)
        : Infinity;
    const { getTokensLength } = useTokenizer(modelTokenizer);

    const {
      content,
      setContent,
      addPromptContent,
      activePromptIndex,
      setActivePromptIndex,
      isModalVisible,
      setIsModalVisible,
      isPromptLimitModalOpen,
      setIsPromptLimitModalOpen,
      showPromptList,
      setShowPromptList,
      updatePromptListVisibility,
      filteredPrompts,
      handleKeyDownIfShown,
      getPrompt,
      isLoading,
      selectedPrompt,
    } = usePromptSelection(maxTokensLength, modelTokenizer, '');

    const isSchemaValueValid = useMemo(() => {
      const schema =
        selectedConversations.map(getConversationSchema)?.[0] ??
        (selectedConversations[0]?.messages?.length === 0
          ? configurationSchema
          : undefined);

      if (!schema) return true;

      return isFormValueValid(schema, chatFormValue);
    }, [selectedConversations, configurationSchema, chatFormValue]);

    const selectedAttachmentsIds = useMemo(
      () =>
        selectedFiles
          .map((f) => f.id)
          .concat(selectedFolders.map((f) => addTrailingSlashIfAbsent(f.id))),
      [selectedFolders, selectedFiles],
    );

    const isInputEmpty = useMemo(() => {
      return (
        !content.trim().length &&
        !selectedFiles.length &&
        !selectedFolders.length &&
        !selectedDialLinks.length
      );
    }, [
      content,
      selectedDialLinks.length,
      selectedFiles.length,
      selectedFolders.length,
    ]);
    const isSendDisabled =
      isDisabledInputFeature ||
      isReplay ||
      isMessageError ||
      isInputEmpty ||
      !areModelsLoaded ||
      isUploadingFilePresent ||
      isConversationNameInvalid ||
      isConversationPathInvalid ||
      !isSchemaValueValid ||
      isTranscribing;

    const canAttach =
      (canAttachFiles || canAttachFolders || canAttachLinks) &&
      !!maximumAttachmentsAmount;

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        const valueTokensLength = getTokensLength(value);

        if (maxTokensLength && valueTokensLength > maxTokensLength) {
          setIsPromptLimitModalOpen(true);
          return;
        }

        setContent(value);
        updatePromptListVisibility(value);
      },
      [
        getTokensLength,
        maxTokensLength,
        setContent,
        setIsPromptLimitModalOpen,
        updatePromptListVisibility,
      ],
    );

    const handleSend = useCallback(() => {
      if (messageIsStreaming) {
        onStopConversation();
        return;
      }

      if (shouldRegenerate) {
        onRegenerate();
        return;
      }

      if (isSendDisabled) {
        return;
      }

      dispatch(ConversationsActions.setIsMessageSending(true));

      const templateMapping = Array.from(
        promptTemplateMappingRef.current,
      ).filter(([key]) => content.includes(key));

      onSend({
        role: Role.User,
        content: content,
        custom_content: {
          ...getUserCustomContent(
            selectedFiles,
            selectedFolders,
            selectedDialLinks,
          ),
          ...(chatFormValue && isChatEmpty
            ? {
                configuration_value: chatFormValue,
                configuration_schema: configurationSchema,
              }
            : {
                form_value: chatFormValue,
              }),
        },
        templateMapping,
      });
      setSelectedDialLinks([]);
      dispatch(FilesActions.resetSelectedFiles());
      dispatch(ChatActions.resetFormValue());
      setContent('');

      if (window.innerWidth < 640 && textareaRef && textareaRef.current) {
        textareaRef.current.blur();
      }
    }, [
      messageIsStreaming,
      shouldRegenerate,
      isSendDisabled,
      dispatch,
      onSend,
      content,
      selectedFiles,
      selectedFolders,
      selectedDialLinks,
      chatFormValue,
      isChatEmpty,
      configurationSchema,
      setContent,
      textareaRef,
      onStopConversation,
      onRegenerate,
    ]);

    const allowEnterClick = useAppSelector(UISelectors.selectAllowEnterToSend);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (showPromptList && filteredPrompts.length > 0) {
          handleKeyDownIfShown(e);
        } else if (!isTyping && allowEnterClick(e)) {
          e.preventDefault();
          if (isReplay || messageIsStreaming) {
            return;
          }
          handleSend();
        } else if (e.key === '/' && e.metaKey) {
          e.preventDefault();
          setShowPluginSelect(!showPluginSelect);
        }
      },
      [
        showPromptList,
        filteredPrompts.length,
        isTyping,
        allowEnterClick,
        handleKeyDownIfShown,
        isReplay,
        messageIsStreaming,
        handleSend,
        showPluginSelect,
      ],
    );

    const handlePromptApply = useCallback(
      (newContent: string) => {
        const valueTokensLength = getTokensLength(newContent);

        if (valueTokensLength > maxTokensLength) {
          setIsPromptLimitModalOpen(true);
          return;
        }

        addPromptContent(newContent);
        if (promptTemplateMappingRef.current) {
          promptTemplateMappingRef.current.set(
            newContent.trim(),
            (
              (filteredPrompts[activePromptIndex] as Prompt)?.content || ''
            ).trim(),
          );
        }

        if (textareaRef && textareaRef.current) {
          textareaRef.current.focus();
        }
      },
      [
        activePromptIndex,
        addPromptContent,
        filteredPrompts,
        getTokensLength,
        maxTokensLength,
        setIsPromptLimitModalOpen,
        textareaRef,
      ],
    );

    const handleUnselectFile = useCallback(
      (fileId: string) => {
        dispatch(FilesActions.unselectFiles({ ids: [fileId] }));
      },
      [dispatch],
    );

    const handleRetry = useCallback(
      (fileId: string) => {
        dispatch(FilesActions.reuploadFile({ fileId }));
      },
      [dispatch],
    );

    const handleSelectAlreadyUploaded = useCallback(
      (result: string[]) => {
        dispatch(FilesActions.resetSelectedFiles());
        dispatch(
          FilesActions.selectFiles({
            ids: result,
          }),
        );
      },
      [dispatch],
    );

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
        dispatch(
          FilesActions.selectFiles({
            ids: selectedFiles.map(({ id }) => id),
          }),
        );
      },
      [dispatch],
    );

    const handleAddLinkToMessage = useCallback((link: DialLink) => {
      setSelectedDialLinks((links) => links.concat([link]));
    }, []);
    const handleUnselectLink = useCallback((unselectedIndex: number) => {
      setSelectedDialLinks((links) =>
        links.filter((_link, index) => unselectedIndex !== index),
      );
    }, []);

    const tooltipContent = (): string => {
      if (isDisabledInputFeature && disabledInputFeatureData?.description) {
        return disabledInputFeatureData.description;
      }
      if (messageIsStreaming) {
        return t(ChatI18nKeys.StopGenerating);
      }
      if (!areModelsLoaded) {
        return t(ChatI18nKeys.WaitForModelsToLoad);
      }
      if (isReplay) {
        return t(ChatI18nKeys.ContinueReplayToWork);
      }
      if (shouldRegenerate) {
        return t(ChatI18nKeys.RegenerateResponse);
      }
      if (isUploadingFilePresent) {
        return t(ChatI18nKeys.WaitForAttachmentToLoad);
      }
      if (isConversationNameInvalid) {
        return t(errorsMessages.entityNameInvalid);
      }
      if (isConversationPathInvalid) {
        return t(errorsMessages.entityPathInvalid);
      }
      if (!isSchemaValueValid) {
        return t(ChatI18nKeys.SelectOneOfOptions);
      }
      return t(ChatI18nKeys.PleaseTypeMessage);
    };

    const chatInputPlaceholder = useMemo(() => {
      if (isChatInputDisabled) return '';
      return t(ChatI18nKeys.TalkToYourAgent);
    }, [isChatInputDisabled, t]);

    const isDisabled = useMemo(
      () => isLoading || isChatInputDisabled || isTranscribing || isSubscribing,
      [isLoading, isChatInputDisabled, isTranscribing, isSubscribing],
    );

    const isMicDisabled = useMemo(
      () => isDisabled || (isAsrMode && messageIsStreaming),
      [isDisabled, isAsrMode, messageIsStreaming],
    );

    useEffect(() => {
      const wasStreaming = prevStreamingRef.current;
      prevStreamingRef.current = messageIsStreaming;

      if (wasStreaming && !messageIsStreaming && isAsrFlowActive) {
        dispatch(ChatActions.clearAsrFlow());
        if (micButtonRef.current && !micButtonRef.current.disabled) {
          micButtonRef.current.focus();
        }
      }
    }, [messageIsStreaming, isAsrFlowActive, dispatch]);

    const paddingLeftClass = canAttach
      ? isOverlay
        ? 'pl-11'
        : 'pl-12'
      : isOverlay
        ? 'pl-3'
        : 'pl-4';

    const paddingRightClass = canRecordAudio
      ? isOverlay
        ? 'pr-[60px]'
        : 'pr-[72px]'
      : isOverlay
        ? 'pr-9'
        : 'pr-10';

    return (
      <div
        className={classNames(
          'mx-3 mb-3 flex flex-row gap-3 md:mx-4 md:mb-0 md:last:mb-5',
          isChatFullWidth ? 'lg:ml-20 lg:mr-[84px]' : 'lg:mx-auto lg:max-w-3xl',
          isPreview && 'px-5',
        )}
        data-qa="send-message-container"
      >
        <div
          className={classNames(
            'relative m-0 flex max-h-[400px] min-h-[38px] w-full grow flex-col rounded bg-layer-3 focus-within:border-accent-primary',
            isChatInputBorderEnabled && 'border border-primary',
            !isChatFullWidth && 'max-w-screen-md',
          )}
        >
          <AdjustedTextarea
            ref={textareaRef}
            className={classNames(
              'm-0 min-h-[38px] w-full grow resize-none bg-transparent leading-[150%] outline-none placeholder:text-secondary',
              isOverlay ? 'py-[7px]' : 'py-2.5 text-base md:py-3',
              paddingRightClass,
              paddingLeftClass,
            )}
            maxHeight={MAX_HEIGHT}
            placeholder={chatInputPlaceholder}
            disabled={isDisabled}
            value={content}
            rows={1}
            onCompositionStart={() => setIsTyping(true)}
            onCompositionEnd={() => setIsTyping(false)}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />
          {isRecording && (
            <VoiceRecordingOverlay
              analyserNode={analyserNode}
              elapsedTime={elapsedTime}
              isOverlay={isOverlay}
            />
          )}
          {isTranscribing && (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center rounded bg-layer-3"
              data-qa="transcribing-overlay"
            >
              <div className="flex items-center gap-2">
                <div className="size-4 animate-spin rounded-full border-2 border-x-transparent border-b-transparent border-t-current text-secondary" />
                <span className="text-sm text-secondary">
                  {t(ChatI18nKeys.TranscribingAudio).replace(/\.+$/, '')}
                  <span
                    className="inline-flex w-[1.2em] text-left"
                    aria-hidden="true"
                  >
                    <span className="animate-pulse">.</span>
                    <span className="animate-pulse [animation-delay:200ms]">
                      .
                    </span>
                    <span className="animate-pulse [animation-delay:400ms]">
                      .
                    </span>
                  </span>
                </span>
              </div>
            </div>
          )}
          {canRecordAudio && (
            <MicrophoneButton
              ref={micButtonRef}
              isRecording={isRecording}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              error={voiceError}
              disabled={isMicDisabled}
            />
          )}
          {!isRecording && (
            <ChatControls
              showReplayControls={showReplayControls}
              onSend={handleSend}
              tooltip={tooltipContent()}
              isLastMessageError={isLastMessageError}
              isLoading={isLoading}
              isSendDisabled={isSendDisabled}
            />
          )}
          {canAttach && (
            <>
              <div
                className={classNames(
                  'absolute cursor-pointer rounded disabled:cursor-not-allowed',
                  isOverlay
                    ? 'bottom-2 left-3'
                    : 'bottom-2.5 left-4 md:bottom-3',
                )}
              >
                <AttachButton
                  selectedFilesIds={selectedAttachmentsIds}
                  onSelectAlreadyUploaded={handleSelectAlreadyUploaded}
                  onUploadFromDevice={handleUploadFromDevice}
                  onAddLinkToMessage={handleAddLinkToMessage}
                />
              </div>
              {(selectedFiles.length > 0 ||
                selectedDialLinks.length > 0 ||
                selectedFolders.length > 0) && (
                <div
                  className={classNames(
                    'mb-2.5 flex max-h-[100px] min-h-0 min-w-0 flex-col gap-1 overflow-y-auto pl-12 md:grid md:auto-rows-min md:[grid-template-columns:repeat(3,minmax(0,1fr))]',
                    canRecordAudio ? paddingRightClass : 'pr-12',
                  )}
                  data-qa="attachment-container"
                >
                  <ChatInputAttachments
                    files={selectedFiles}
                    folders={selectedFolders}
                    links={selectedDialLinks}
                    onUnselectFile={handleUnselectFile}
                    onRetryFile={handleRetry}
                    onUnselectLink={handleUnselectLink}
                  />
                </div>
              )}
            </>
          )}

          {showScrollDownButton && (
            <ScrollDownButton
              className="-top-16 right-0 md:-top-20"
              onScrollDownClick={onScrollDownClick}
            />
          )}

          {showPromptList && filteredPrompts.length > 0 && (
            <div className="absolute bottom-12 w-full">
              <PromptList
                activePromptIndex={activePromptIndex}
                prompts={filteredPrompts}
                onSelect={getPrompt}
                onMouseEnter={setActivePromptIndex}
                isOpen={showPromptList && filteredPrompts.length > 0}
                onClose={() => setShowPromptList(false)}
              />
            </div>
          )}

          {isModalVisible && selectedPrompt && (
            <PromptVariablesDialog
              prompt={selectedPrompt}
              onSubmit={handlePromptApply}
              onClose={() => setIsModalVisible(false)}
            />
          )}
          <ReplayVariables />
        </div>

        <ConfirmDialog
          isOpen={isPromptLimitModalOpen}
          heading={t(ChatI18nKeys.PromptLimitExceeded)}
          description={t(ChatI18nKeys.PromptLimitDescription, {
            maxTokensLength,
            limitDescription: getPromptLimitDescription(
              getTokensLength(content),
              maxTokensLength,
            ),
          })}
          confirmLabel={t(ChatI18nKeys.Confirm)}
          onClose={() => {
            setIsPromptLimitModalOpen(false);
          }}
        />
      </div>
    );
  },
);

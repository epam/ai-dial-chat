import {
  KeyboardEvent,
  MutableRefObject,
  useCallback,
  useMemo,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { usePromptSelection } from '@/src/hooks/usePromptSelection';
import { useTokenizer } from '@/src/hooks/useTokenizer';

import { getUserCustomContent } from '@/src/utils/app/file';
import { isMobile } from '@/src/utils/app/mobile';
import { getPromptLimitDescription } from '@/src/utils/app/modals';

import { Message, Role } from '@/src/types/chat';
import { DialFile, DialLink } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';

import { ScrollDownButton } from '../../Common/ScrollDownButton';
import { AttachButton } from '../../Files/AttachButton';
import { AdjustedTextarea } from '../ChatMessage/AdjustedTextarea';
import { ChatInputAttachments } from './ChatInputAttachments';
import { PromptList } from './PromptList';
import { PromptVariablesDialog } from './PromptVariablesDialog';
import { SendMessageButton } from './SendMessageButton';

interface Props {
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  showScrollDownButton: boolean;
  onScrollDownClick: () => void;
  onSend: (message: Message) => void;
  onStopConversation: () => void;
}

const MAX_HEIGHT = 320;

export const ChatInputMessage = ({
  textareaRef,
  showScrollDownButton,
  onScrollDownClick,
  onSend,
  onStopConversation,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [showPluginSelect, setShowPluginSelect] = useState(false);
  const [selectedDialLinks, setSelectedDialLinks] = useState<DialLink[]>([]);
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const isReplay = useAppSelector(
    ConversationsSelectors.selectIsReplaySelectedConversations,
  );
  const canAttach = useAppSelector(ConversationsSelectors.selectCanAttachFile);
  const selectedFiles = useAppSelector(FilesSelectors.selectSelectedFiles);
  const isUploadingFilePresent = useAppSelector(
    FilesSelectors.selectIsUploadingFilePresent,
  );

  const attachedFilesIds = useAppSelector(
    FilesSelectors.selectSelectedFilesIds,
  );

  const isMessageError = useAppSelector(
    ConversationsSelectors.selectIsMessagesError,
  );
  const isLastAssistantMessageEmpty = useAppSelector(
    ConversationsSelectors.selectIsLastAssistantMessageEmpty,
  );
  const isModelsLoaded = useAppSelector(ModelsSelectors.selectIsModelsLoaded);
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);

  const isError = isLastAssistantMessageEmpty || isMessageError;

  const selectedModels = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsModels,
  );
  const modelTokenizer =
    selectedModels?.length === 1 ? selectedModels[0]?.tokenizer : undefined;
  const maxTokensLength =
    selectedModels.length === 1
      ? selectedModels[0]?.limits?.maxRequestTokens ?? Infinity
      : Infinity;
  const { getTokensLength } = useTokenizer(modelTokenizer);

  const {
    content,
    setContent,
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
  } = usePromptSelection(maxTokensLength, modelTokenizer, '');

  const isInputEmpty = useMemo(() => {
    return (
      content.trim().length === 0 &&
      selectedFiles.length === 0 &&
      !selectedDialLinks.length
    );
  }, [content, selectedDialLinks.length, selectedFiles.length]);
  const isSendDisabled =
    isReplay ||
    isError ||
    isInputEmpty ||
    !isModelsLoaded ||
    isUploadingFilePresent;

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

    if (isSendDisabled) {
      return;
    }

    onSend({
      role: Role.User,
      content,
      custom_content: getUserCustomContent(selectedFiles, selectedDialLinks),
    });
    setSelectedDialLinks([]);
    dispatch(FilesActions.resetSelectedFiles());
    setContent('');

    if (window.innerWidth < 640 && textareaRef && textareaRef.current) {
      textareaRef.current.blur();
    }
  }, [
    messageIsStreaming,
    isSendDisabled,
    onSend,
    content,
    selectedFiles,
    selectedDialLinks,
    dispatch,
    setContent,
    textareaRef,
    onStopConversation,
  ]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (showPromptList && filteredPrompts.length > 0) {
        handleKeyDownIfShown(e);
      } else if (e.key === 'Enter' && !isTyping && !isMobile() && !e.shiftKey) {
        e.preventDefault();
        if (isReplay) {
          return;
        }
        handleSend();
      } else if (e.key === '/' && e.metaKey) {
        e.preventDefault();
        setShowPluginSelect(!showPluginSelect);
      }
    },
    [
      handleKeyDownIfShown,
      handleSend,
      isReplay,
      isTyping,
      showPluginSelect,
      showPromptList,
      filteredPrompts,
    ],
  );

  const handlePromptApply = useCallback(
    (newContent: string) => {
      const valueTokensLength = getTokensLength(newContent);

      if (valueTokensLength > maxTokensLength) {
        setIsPromptLimitModalOpen(true);
        return;
      }

      setContent(newContent);

      if (textareaRef && textareaRef.current) {
        textareaRef.current.focus();
      }
    },
    [
      getTokensLength,
      maxTokensLength,
      setContent,
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
    (result: unknown) => {
      if (typeof result === 'object') {
        const selectedFilesIds = result as string[];
        dispatch(FilesActions.resetSelectedFiles());
        dispatch(
          FilesActions.selectFiles({
            ids: selectedFilesIds,
          }),
        );
      }
    },
    [dispatch],
  );

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
    if (messageIsStreaming) {
      return t('Stop generating');
    }
    if (!isModelsLoaded) {
      return t(
        'Please wait for models will be loaded to continue working with chat',
      );
    }
    if (isReplay) {
      return t('Please continue replay to continue working with chat');
    }
    if (isError) {
      return t('Please regenerate response to continue working with chat');
    }
    if (isUploadingFilePresent) {
      return t('Please wait for the attachment to load');
    }
    return t('Please type a message');
  };

  const paddingLeftClass = canAttach
    ? isOverlay
      ? 'pl-11'
      : 'pl-12'
    : isOverlay
      ? 'pl-3'
      : 'pl-4';

  return (
    <div
      className={classNames(
        'mx-2 mb-2 flex flex-row gap-3 md:mx-4 md:mb-0 md:last:mb-6',
        isChatFullWidth ? 'lg:ml-20 lg:mr-[84px]' : 'lg:mx-auto lg:max-w-3xl',
      )}
    >
      <div
        className="relative m-0 flex max-h-[400px] min-h-[38px] w-full grow flex-col rounded bg-layer-3 focus-within:border-accent-primary"
        data-qa="message"
      >
        <AdjustedTextarea
          ref={textareaRef}
          className={classNames(
            'm-0 min-h-[38px] w-full grow resize-none bg-transparent leading-[150%] outline-none placeholder:text-secondary',
            isOverlay ? 'py-[7px] pr-9' : 'py-2.5 pr-10 text-base md:py-3',
            paddingLeftClass,
          )}
          maxHeight={MAX_HEIGHT}
          placeholder={
            isOverlay
              ? t('Type a message') || ''
              : t('Type a text or «/» to use a prompt...') || ''
          }
          disabled={isLoading}
          value={content}
          rows={1}
          onCompositionStart={() => setIsTyping(true)}
          onCompositionEnd={() => setIsTyping(false)}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />

        <SendMessageButton
          handleSend={handleSend}
          isDisabled={isSendDisabled}
          tooltip={tooltipContent()}
          isLoading={isLoading}
        />
        {canAttach && (
          <>
            <div className="absolute left-4 top-[calc(50%_-_12px)] rounded disabled:cursor-not-allowed">
              <AttachButton
                selectedFilesIds={attachedFilesIds}
                onSelectAlreadyUploaded={handleSelectAlreadyUploaded}
                onUploadFromDevice={handleUploadFromDevice}
                onAddLinkToMessage={handleAddLinkToMessage}
              />
            </div>
            {(selectedFiles.length > 0 || selectedDialLinks.length > 0) && (
              <div className="mb-2.5 flex max-h-[100px] flex-col gap-1 overflow-auto px-12 md:grid md:grid-cols-3">
                <ChatInputAttachments
                  files={selectedFiles}
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
            className="-top-16 right-0 md:-right-14 md:top-[50%] md:-translate-y-1/2"
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

        {isModalVisible && (
          <PromptVariablesDialog
            prompt={filteredPrompts[activePromptIndex]}
            onSubmit={handlePromptApply}
            onClose={() => setIsModalVisible(false)}
          />
        )}
      </div>

      <ConfirmDialog
        isOpen={isPromptLimitModalOpen}
        heading={t('Prompt limit exceeded')}
        description={
          t(
            `Prompt limit is ${maxTokensLength} tokens.
            ${getPromptLimitDescription(getTokensLength(content), maxTokensLength)}`,
          ) || ''
        }
        confirmLabel={t('Confirm')}
        onClose={() => {
          setIsPromptLimitModalOpen(false);
        }}
      />
    </div>
  );
};

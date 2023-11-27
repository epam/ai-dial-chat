import {
  KeyboardEvent,
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getUserCustomContent } from '@/src/utils/app/file';
import { isMobile } from '@/src/utils/app/mobile';

import { Message, Role } from '@/src/types/chat';
import { Feature } from '@/src/types/features';
import { DialFile } from '@/src/types/files';
import { OpenAIEntityModels, defaultModelLimits } from '@/src/types/openai';
import { Prompt } from '@/src/types/prompt';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { PromptsSelectors } from '@/src/store/prompts/prompts.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { ScrollDownButton } from '../../Common/ScrollDownButton';
import { AttachButton } from '../../Files/AttachButton';
import { ChatInputAttachments } from './ChatInputAttachments';
import { PromptDialog } from './PromptDialog';
import { PromptList } from './PromptList';
import { SendMessageButton } from './SendMessageButton';

interface Props {
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  showScrollDownButton: boolean;
  onScrollDownClick: () => void;
  onSend: (message: Message) => void;
}

export const ChatInputMessage = ({
  textareaRef,
  showScrollDownButton,
  onScrollDownClick,
  onSend,
}: Props) => {
  const { t } = useTranslation('chat');
  const dispatch = useAppDispatch();

  const [content, setContent] = useState<string>();
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [showPromptList, setShowPromptList] = useState(false);
  const [activePromptIndex, setActivePromptIndex] = useState(0);
  const [promptInputValue, setPromptInputValue] = useState('');
  const [variables, setVariables] = useState<string[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showPluginSelect, setShowPluginSelect] = useState(false);

  const selectedFiles = useAppSelector(FilesSelectors.selectSelectedFiles);
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);
  const isIframe = useAppSelector(SettingsSelectors.selectIsIframe);
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const isReplay = useAppSelector(
    ConversationsSelectors.selectIsReplaySelectedConversations,
  );
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const selectedFiles = useAppSelector(FilesSelectors.selectSelectedFiles);
  const maximumAttachmentsAmount = useAppSelector(
    ConversationsSelectors.selectMaximumAttachmentsAmount,
  );
  const displayAttachFunctionality =
    enabledFeatures.has(Feature.InputFiles) && maximumAttachmentsAmount > 0;
  const attachedFilesIds = useAppSelector(
    FilesSelectors.selectSelectedFilesIds,
  );

  const [filteredPrompts, setFilteredPrompts] = useState(() =>
    prompts.filter((prompt) =>
      prompt.name.toLowerCase().includes(promptInputValue.toLowerCase()),
    ),
  );

  const maxLength = useMemo(() => {
    const maxLengthArray = selectedConversations.map(
      ({ model }) =>
        modelsMap[model.id]?.maxLength ??
        OpenAIEntityModels[model.id]?.maxLength ??
        defaultModelLimits.maxLength,
    );

    return Math.min(...maxLengthArray);
  }, [modelsMap, selectedConversations]);

  const updatePromptListVisibility = useCallback((text: string) => {
    const match = text.match(/\/\w*$/);

    if (match) {
      setShowPromptList(true);
      setPromptInputValue(match[0].slice(1));
    } else {
      setShowPromptList(false);
      setPromptInputValue('');
    }
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;

      if (maxLength && value.length > maxLength) {
        alert(
          t(
            `Message limit is {{maxLength}} characters. You have entered {{valueLength}} characters.`,
            { maxLength, valueLength: value.length },
          ),
        );
        return;
      }

      setContent(value);
      updatePromptListVisibility(value);
    },
    [maxLength, t, updatePromptListVisibility],
  );

  const handleSend = useCallback(() => {
    if (messageIsStreaming) {
      return;
    }

    if (!content) {
      alert(t('Please enter a message'));
      return;
    }

    onSend({
      role: Role.User,
      content,
      ...getUserCustomContent(selectedFiles),
    });
    dispatch(FilesActions.resetSelectedFiles());
    setContent('');

    if (window.innerWidth < 640 && textareaRef && textareaRef.current) {
      textareaRef.current.blur();
    }
  }, [
    content,
    dispatch,
    selectedFiles,
    messageIsStreaming,
    onSend,
    t,
    textareaRef,
  ]);

  const parseVariables = useCallback((content: string) => {
    const regex = /{{(.*?)}}/g;
    const foundVariables = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      foundVariables.push(match[1]);
    }

    return foundVariables;
  }, []);

  const handlePromptSelect = useCallback(
    (prompt: Prompt) => {
      if (!prompt.content) {
        return;
      }

      const parsedVariables = parseVariables(prompt.content);
      setVariables(parsedVariables);

      if (parsedVariables.length > 0) {
        setIsModalVisible(true);
      } else {
        setContent((prevContent) => {
          const updatedContent = prevContent?.replace(
            /\/\w*$/,
            prompt.content as string,
          );
          return updatedContent;
        });
        updatePromptListVisibility(prompt.content);
      }
    },
    [parseVariables, updatePromptListVisibility],
  );

  const handleInitModal = useCallback(() => {
    const selectedPrompt = filteredPrompts[activePromptIndex];
    if (selectedPrompt && !!selectedPrompt.content) {
      setContent((prevContent) => {
        const newContent = prevContent?.replace(
          /\/\w*$/,
          selectedPrompt.content as string,
        );
        return newContent;
      });
      handlePromptSelect(selectedPrompt);
    }
    setShowPromptList(false);
  }, [activePromptIndex, filteredPrompts, handlePromptSelect]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (showPromptList) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActivePromptIndex((prevIndex) =>
            prevIndex < prompts.length - 1 ? prevIndex + 1 : prevIndex,
          );
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActivePromptIndex((prevIndex) =>
            prevIndex > 0 ? prevIndex - 1 : prevIndex,
          );
        } else if (e.key === 'Tab') {
          e.preventDefault();
          setActivePromptIndex((prevIndex) =>
            prevIndex < prompts.length - 1 ? prevIndex + 1 : 0,
          );
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleInitModal();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setShowPromptList(false);
        } else {
          setActivePromptIndex(0);
        }
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
      handleInitModal,
      handleSend,
      isReplay,
      isTyping,
      prompts.length,
      showPluginSelect,
      showPromptList,
    ],
  );

  const handleSubmit = useCallback(
    (updatedVariables: string[]) => {
      const newContent = content?.replace(/{{(.*?)}}/g, (match, variable) => {
        const index = variables.indexOf(variable);
        return updatedVariables[index];
      });

      setContent(newContent);

      if (textareaRef && textareaRef.current) {
        textareaRef.current.focus();
      }
    },
    [content, textareaRef, variables],
  );

  useEffect(() => {
    setFilteredPrompts(
      prompts.filter((prompt) =>
        prompt.name.toLowerCase().includes(promptInputValue.toLowerCase()),
      ),
    );
  }, [prompts, promptInputValue]);

  useEffect(() => {
    if (textareaRef && textareaRef.current) {
      textareaRef.current.style.height = 'inherit'; // reset height
      const scrollHeight = textareaRef.current.scrollHeight; // then check scroll height
      textareaRef.current.style.height = `${scrollHeight}px`;
      textareaRef.current.style.overflow = `${
        scrollHeight > 400 ? 'auto' : 'hidden'
      }`;
    }
  }, [content, textareaRef]);

  const handleUnselectFile = useCallback(
    (fileId: string) => {
      return () => dispatch(FilesActions.unselectFiles({ ids: [fileId] }));
    },
    [dispatch],
  );

  const handleRetry = useCallback(
    (fileId: string) => {
      return () => dispatch(FilesActions.reuploadFile({ fileId }));
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

  return (
    <div className="mx-2 mb-2 flex flex-row gap-3 md:mx-4 md:mb-0  md:last:mb-6 lg:mx-auto lg:max-w-3xl">
      <div
        className="relative m-0 flex max-h-[400px] min-h-[40px] w-full grow flex-col rounded bg-gray-100 focus-within:border-blue-500 dark:bg-gray-700"
        data-qa="message"
      >
        <textarea
          ref={textareaRef}
          className={classNames(
            'm-0 max-h-[320px] min-h-[40px] w-full grow resize-none bg-transparent py-3 pr-10 outline-none placeholder:text-gray-500',
            displayAttachFunctionality ? 'pl-12' : 'pl-4',
          )}
          style={{
            bottom: `${textareaRef?.current?.scrollHeight}px`,
            overflow: `${
              textareaRef.current && textareaRef.current.scrollHeight > 400
                ? 'auto'
                : 'hidden'
            }`,
          }}
          placeholder={
            isIframe
              ? t('Type a message') || ''
              : t('Type a message or type "/" to select a prompt...') || ''
          }
          value={content}
          rows={1}
          onCompositionStart={() => setIsTyping(true)}
          onCompositionEnd={() => setIsTyping(false)}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />

        <SendMessageButton
          handleSend={handleSend}
          isInputEmpty={
            (!content || content.trim().length === 0) &&
            selectedFiles.length === 0
          }
        />

        {displayAttachFunctionality && (
          <>
            <div className="absolute left-4 top-[calc(50%_-_12px)] rounded disabled:cursor-not-allowed">
              <AttachButton
                selectedFilesIds={attachedFilesIds}
                onSelectAlreadyUploaded={handleSelectAlreadyUploaded}
                onUploadFromDevice={handleUploadFromDevice}
              />
            </div>
            {selectedFiles.length > 0 && (
              <div className="mb-2.5 grid max-h-[100px] grid-cols-3 gap-1 overflow-auto px-12">
                <ChatInputAttachments
                  files={selectedFiles}
                  onUnselectFile={handleUnselectFile}
                  onRetryFile={handleRetry}
                />
              </div>
            )}
          </>
        )}

        {showScrollDownButton && (
          <ScrollDownButton
            className="-top-14 right-0 xl:right-2 2xl:bottom-0 2xl:right-[-60px] 2xl:top-auto"
            onScrollDownClick={onScrollDownClick}
          />
        )}

        {showPromptList && filteredPrompts.length > 0 && (
          <div className="absolute bottom-12 w-full">
            <PromptList
              activePromptIndex={activePromptIndex}
              prompts={filteredPrompts}
              onSelect={handleInitModal}
              onMouseEnter={setActivePromptIndex}
              isOpen={showPromptList && filteredPrompts.length > 0}
              onClose={() => setShowPromptList(false)}
            />
          </div>
        )}

        {isModalVisible && (
          <PromptDialog
            prompt={filteredPrompts[activePromptIndex]}
            variables={variables}
            onSubmit={handleSubmit}
            onClose={() => setIsModalVisible(false)}
          />
        )}
      </div>
    </div>
  );
};

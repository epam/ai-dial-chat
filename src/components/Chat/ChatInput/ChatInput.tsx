import { IconPlayerStop } from '@tabler/icons-react';
import {
  KeyboardEvent,
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { isMobile } from '@/src/utils/app/mobile';

import { Message } from '@/src/types/chat';
import { Feature } from '@/src/types/features';
import { OpenAIEntityModels, defaultModelLimits } from '@/src/types/openai';
import { Prompt } from '@/src/types/prompt';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { PromptsSelectors } from '@/src/store/prompts/prompts.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import RefreshCWAlt from '../../../../public/images/icons/refresh-cw-alt.svg';
import { FooterMessage } from '../../Common/FooterMessage';
import { ScrollDownButton } from '../../Common/ScrollDownButton';
import { AttachButton } from './AttachButton';
import { ChatInputAttachments } from './ChatInputAttachments';
import { PromptDialog } from './PromptDialog';
import { PromptList } from './PromptList';
import { SendMessageButton } from './SendMessageButton';

interface Props {
  onSend: (message: Message) => void;
  onRegenerate: () => void;
  onScrollDownClick: () => void;
  onStopConversation: () => void;
  onResize: (height: number) => void;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  showScrollDownButton: boolean;
  isMessagesPresented: boolean;
}

export const ChatInput = ({
  onSend,
  onRegenerate,
  onScrollDownClick,
  onStopConversation,
  onResize,
  textareaRef,
  showScrollDownButton,
  isMessagesPresented,
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

  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );

  const isIframe = useAppSelector(SettingsSelectors.selectIsIframe);
  const files = useAppSelector(FilesSelectors.selectSelectedFiles);
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );
  const maximumAttachmentsAmount = useAppSelector(
    ConversationsSelectors.selectMaximumAttachmentsAmount,
  );

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const maxLength = useMemo(() => {
    const maxLengthArray = selectedConversations.map(
      ({ model }) =>
        modelsMap[model.id]?.maxLength ??
        OpenAIEntityModels[model.id]?.maxLength ??
        defaultModelLimits.maxLength,
    );

    return Math.min(...maxLengthArray);
  }, [modelsMap, selectedConversations]);

  const promptListRef = useRef<HTMLUListElement | null>(null);
  const inputRef = useRef<HTMLDivElement | null>(null);

  const [filteredPrompts, setFilteredPrompts] = useState(() =>
    prompts.filter((prompt) =>
      prompt.name.toLowerCase().includes(promptInputValue.toLowerCase()),
    ),
  );

  const displayAttachFunctionality =
    enabledFeatures.has(Feature.InputFiles) && maximumAttachmentsAmount > 0;

  useEffect(() => {
    setFilteredPrompts(
      prompts.filter((prompt) =>
        prompt.name.toLowerCase().includes(promptInputValue.toLowerCase()),
      ),
    );
  }, [prompts, promptInputValue]);

  useEffect(() => {
    if (!inputRef) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      inputRef.current?.clientHeight && onResize(inputRef.current.clientHeight);
    });
    inputRef.current && resizeObserver.observe(inputRef.current);

    () => {
      resizeObserver.disconnect();
    };
  }, [inputRef, onResize]);

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
      role: 'user',
      content,
      ...(files.length > 0 && {
        custom_content: {
          attachments: files
            .filter(
              (file) => file.status !== 'FAILED' && file.status !== 'UPLOADING',
            )
            .map((file) => ({
              type: file.contentType,
              title: file.name,
              url: encodeURI(file.absolutePath + '/' + file.name),
            })),
        },
      }),
    });
    setContent('');
    dispatch(FilesActions.resetSelectedFiles());

    if (window.innerWidth < 640 && textareaRef && textareaRef.current) {
      textareaRef.current.blur();
    }
  }, [messageIsStreaming, content, onSend, files, dispatch, textareaRef, t]);

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
        handleSend();
      } else if (e.key === '/' && e.metaKey) {
        e.preventDefault();
        setShowPluginSelect(!showPluginSelect);
      }
    },
    [
      handleInitModal,
      handleSend,
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
    if (promptListRef.current) {
      promptListRef.current.scrollTop = activePromptIndex * 30;
    }
  }, [activePromptIndex]);

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

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        promptListRef.current &&
        !promptListRef.current.contains(e.target as Node)
      ) {
        setShowPromptList(false);
      }
    };

    window.addEventListener('click', handleOutsideClick);

    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  return (
    <div
      ref={inputRef}
      className="absolute bottom-0 left-0 w-full border-transparent bg-gradient-to-b from-transparent via-gray-300 to-gray-300 pt-6 dark:via-gray-900 dark:to-gray-900 md:pt-2"
    >
      <div className="relative">
        {messageIsStreaming && (
          <button
            className="absolute inset-x-0 -top-14 mx-auto mb-3 flex w-fit items-center gap-3 rounded border border-gray-400 bg-gray-200 p-3 hover:bg-gray-400 dark:border-gray-600 dark:bg-gray-800 hover:dark:bg-gray-600"
            onClick={onStopConversation}
            data-qa="stop-generating"
          >
            <IconPlayerStop
              size={18}
              className="text-gray-500"
              strokeWidth="1.5"
            />{' '}
            {t('Stop generating')}
          </button>
        )}

        {!messageIsStreaming && isMessagesPresented && (
          <button
            className="absolute inset-x-0 -top-14 mx-auto mb-3 flex w-fit items-center gap-3 rounded border border-gray-400 bg-gray-200 p-3 hover:bg-gray-400 dark:border-gray-600 dark:bg-gray-800 hover:dark:bg-gray-600"
            onClick={onRegenerate}
            data-qa="regenerate"
          >
            <span className="text-gray-500">
              <RefreshCWAlt width={18} height={18} />
            </span>
            {t('Regenerate response')}
          </button>
        )}
      </div>

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
            isInputEmpty={!content || content.trim().length === 0}
          />

          {displayAttachFunctionality && (
            <>
              <AttachButton />
              <ChatInputAttachments />
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
                onMouseOver={setActivePromptIndex}
                promptListRef={promptListRef}
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

      <div className="p-5 max-md:hidden">
        <FooterMessage />
      </div>
    </div>
  );
};

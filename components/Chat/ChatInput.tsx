import {
  IconArrowDown,
  IconPlayerStop,
  IconRepeat,
  IconSend,
} from '@tabler/icons-react';
import {
  ForwardedRef,
  KeyboardEvent,
  MutableRefObject,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import { isMobile } from '@/utils/app/mobile';

import { Message } from '@/types/chat';
import { Prompt } from '@/types/prompt';

import HomeContext from '@/pages/api/home/home.context';

import { FooterMessage } from './FooterMessage';
import { PromptList } from './PromptList';
import { VariableModal } from './VariableModal';

interface Props {
  onSend: (message: Message) => void;
  onRegenerate: () => void;
  onScrollDownClick: () => void;
  onStopConversation: () => void;
  maxLength: number;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  showScrollDownButton: boolean;
  isMessagesPresented: boolean;
}

export const ChatInput = forwardRef(
  (
    {
      onSend,
      onRegenerate,
      onScrollDownClick,
      onStopConversation,
      maxLength,
      textareaRef,
      showScrollDownButton,
      isMessagesPresented,
    }: Props,
    ref: ForwardedRef<HTMLDivElement>,
  ) => {
    const { t } = useTranslation('chat');

    const {
      state: {
        messageIsStreaming,
        prompts,
        footerHtmlMessage,
        enabledFeatures,
        isIframe,
      },
    } = useContext(HomeContext);

    const [content, setContent] = useState<string>();
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [showPromptList, setShowPromptList] = useState(false);
    const [activePromptIndex, setActivePromptIndex] = useState(0);
    const [promptInputValue, setPromptInputValue] = useState('');
    const [variables, setVariables] = useState<string[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [showPluginSelect, setShowPluginSelect] = useState(false);

    const promptListRef = useRef<HTMLUListElement | null>(null);

    const filteredPrompts = prompts.filter((prompt) =>
      prompt.name.toLowerCase().includes(promptInputValue.toLowerCase()),
    );

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
    };

    const handleSend = () => {
      if (messageIsStreaming) {
        return;
      }

      if (!content) {
        alert(t('Please enter a message'));
        return;
      }

      onSend({ role: 'user', content });
      setContent('');

      if (window.innerWidth < 640 && textareaRef && textareaRef.current) {
        textareaRef.current.blur();
      }
    };

    const handleInitModal = () => {
      const selectedPrompt = filteredPrompts[activePromptIndex];
      if (selectedPrompt) {
        setContent((prevContent) => {
          const newContent = prevContent?.replace(
            /\/\w*$/,
            selectedPrompt.content,
          );
          return newContent;
        });
        handlePromptSelect(selectedPrompt);
      }
      setShowPromptList(false);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
    };

    const parseVariables = (content: string) => {
      const regex = /{{(.*?)}}/g;
      const foundVariables = [];
      let match;

      while ((match = regex.exec(content)) !== null) {
        foundVariables.push(match[1]);
      }

      return foundVariables;
    };

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

    const handlePromptSelect = (prompt: Prompt) => {
      const parsedVariables = parseVariables(prompt.content);
      setVariables(parsedVariables);

      if (parsedVariables.length > 0) {
        setIsModalVisible(true);
      } else {
        setContent((prevContent) => {
          const updatedContent = prevContent?.replace(/\/\w*$/, prompt.content);
          return updatedContent;
        });
        updatePromptListVisibility(prompt.content);
      }
    };

    const handleSubmit = (updatedVariables: string[]) => {
      const newContent = content?.replace(/{{(.*?)}}/g, (match, variable) => {
        const index = variables.indexOf(variable);
        return updatedVariables[index];
      });

      setContent(newContent);

      if (textareaRef && textareaRef.current) {
        textareaRef.current.focus();
      }
    };

    useEffect(() => {
      if (promptListRef.current) {
        promptListRef.current.scrollTop = activePromptIndex * 30;
      }
    }, [activePromptIndex]);

    useEffect(() => {
      if (textareaRef && textareaRef.current) {
        textareaRef.current.style.height = 'inherit';
        textareaRef.current.style.height = `${textareaRef.current?.scrollHeight}px`;
        textareaRef.current.style.overflow = `${
          textareaRef?.current?.scrollHeight > 400 ? 'auto' : 'hidden'
        }`;
      }
    }, [content]);

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
        ref={ref}
        className="absolute bottom-0 left-0 w-full border-transparent bg-gradient-to-b from-transparent via-gray-300 to-gray-300 pt-6 dark:border-white/20 dark:via-gray-900 dark:to-gray-900 md:pt-2"
      >
        <div className="mx-2 mt-4 flex flex-row gap-3 last:mb-2 md:mx-4 md:mt-[52px] md:last:mb-6 lg:mx-auto lg:max-w-3xl">
          {messageIsStreaming && (
            <button
              className="absolute inset-x-0 top-0 mx-auto mb-3 flex w-fit items-center gap-3 rounded border border-neutral-200 bg-white px-4 py-2 text-black hover:opacity-50 dark:border-neutral-600 dark:bg-[#343541] dark:text-white md:mb-0 md:mt-2"
              onClick={onStopConversation}
            >
              <IconPlayerStop size={16} /> {t('Stop generating')}
            </button>
          )}

          {!messageIsStreaming && isMessagesPresented && (
            <button
              className="absolute inset-x-0 top-0 mx-auto mb-3 flex w-fit items-center gap-3 rounded border border-neutral-200 bg-white px-4 py-2 text-black hover:opacity-50 dark:border-neutral-600 dark:bg-[#343541] dark:text-white md:mb-0 md:mt-2"
              onClick={onRegenerate}
            >
              <IconRepeat size={16} /> {t('Regenerate response')}
            </button>
          )}

          <div className="relative mx-2 flex w-full grow flex-col rounded-md border border-black/10 bg-gray-100 shadow-[0_0_10px_rgba(0,0,0,0.10)] dark:border-gray-900/50 dark:bg-gray-700 dark:shadow-[0_0_15px_rgba(0,0,0,0.10)] sm:mx-4">
            <textarea
              ref={textareaRef}
              className="m-0 w-full resize-none border-0 bg-transparent p-3 dark:bg-transparent"
              style={{
                resize: 'none',
                bottom: `${textareaRef?.current?.scrollHeight}px`,
                maxHeight: '400px',
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

            <button
              className="absolute right-2 top-2 rounded-sm p-1 text-neutral-800 opacity-60 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-opacity-50 dark:text-neutral-100 dark:hover:text-neutral-200"
              onClick={handleSend}
            >
              {messageIsStreaming ? (
                <div className="h-4 w-4 animate-spin rounded-full border-t-2 border-neutral-800 opacity-60 dark:border-neutral-100"></div>
              ) : (
                <IconSend size={18} />
              )}
            </button>

            {showScrollDownButton && (
              <div className="absolute bottom-12 right-0 lg:-right-10 lg:bottom-0">
                <button
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-300 text-gray-800 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-neutral-200"
                  onClick={onScrollDownClick}
                >
                  <IconArrowDown size={18} />
                </button>
              </div>
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
              <VariableModal
                prompt={filteredPrompts[activePromptIndex]}
                variables={variables}
                onSubmit={handleSubmit}
                onClose={() => setIsModalVisible(false)}
              />
            )}
          </div>
        </div>

        <div className="p-5 max-md:hidden">
          <FooterMessage
            isShowFooter={enabledFeatures.has('footer')}
            isShowRequestApiKey={enabledFeatures.has('request-api-key')}
            isShowReportAnIssue={enabledFeatures.has('report-an-issue')}
            footerHtmlMessage={footerHtmlMessage}
          />
        </div>
      </div>
    );
  },
);

ChatInput.displayName = 'ChatInput';

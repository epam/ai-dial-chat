import {
  FC,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { DEFAULT_SYSTEM_PROMPT } from '@/src/constants/default-settings';

import { PromptDialog } from './ChatInput/PromptDialog';
import { PromptList } from './ChatInput/PromptList';

interface Props {
  maxLength: number;
  prompt: string | undefined;
  prompts: Prompt[];
  onChangePrompt: (prompt: string) => void;
}

export const SystemPrompt: FC<Props> = ({
  prompts,
  maxLength,
  prompt,
  onChangePrompt,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const [value, setValue] = useState<string>('');
  const [activePromptIndex, setActivePromptIndex] = useState(0);
  const [showPromptList, setShowPromptList] = useState(false);
  const [promptInputValue, setPromptInputValue] = useState('');
  const [variables, setVariables] = useState<string[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const promptListRef = useRef<HTMLUListElement | null>(null);

  const filteredPrompts = prompts.filter((prompt) =>
    prompt.name.toLowerCase().includes(promptInputValue.toLowerCase()),
  );

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

      if (value.length > maxLength) {
        alert(
          t(
            `Prompt limit is {{maxLength}} characters. You have entered {{valueLength}} characters.`,
            { maxLength, valueLength: value.length },
          ),
        );
        return;
      }

      setValue(value);
      updatePromptListVisibility(value);

      onChangePrompt(value);
    },
    [maxLength, onChangePrompt, t, updatePromptListVisibility],
  );

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
        const updatedContent = value?.replace(/\/\w*$/, prompt.content);

        setValue(updatedContent);
        onChangePrompt(updatedContent);

        updatePromptListVisibility(prompt.content);
      }
    },
    [onChangePrompt, parseVariables, updatePromptListVisibility, value],
  );

  const handleInitModal = useCallback(() => {
    const selectedPrompt = filteredPrompts[activePromptIndex];

    if (!selectedPrompt.content) {
      return;
    }
    setValue((prevVal) => {
      const newContent = prevVal?.replace(/\/\w*$/, selectedPrompt.content!);
      return newContent;
    });
    handlePromptSelect(selectedPrompt);
    setShowPromptList(false);
  }, [activePromptIndex, filteredPrompts, handlePromptSelect]);

  const handleSubmit = useCallback(
    (updatedVariables: string[]) => {
      const newContent = value?.replace(/{{(.*?)}}/g, (match, variable) => {
        const index = variables.indexOf(variable);
        return updatedVariables[index];
      });

      setValue(newContent);
      onChangePrompt(newContent);

      if (textareaRef && textareaRef.current) {
        textareaRef.current.focus();
      }
    },
    [onChangePrompt, value, variables],
  );

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
      }
    },
    [handleInitModal, prompts.length, showPromptList],
  );

  useEffect(() => {
    if (textareaRef && textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
      textareaRef.current.style.height = `${textareaRef.current?.scrollHeight}px`;
    }
  }, [value]);

  useEffect(() => {
    if (prompt) {
      setValue(prompt);
    } else {
      setValue(DEFAULT_SYSTEM_PROMPT);
    }
  }, [prompt]);

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

  useEffect(() => {
    if (textareaRef && textareaRef.current) {
      textareaRef.current.style.height = 'inherit'; // reset height
      const scrollHeight = textareaRef.current.scrollHeight; // then check scroll height
      textareaRef.current.style.height = `${scrollHeight}px`;
      textareaRef.current.style.overflow = `${
        scrollHeight > 300 ? 'auto' : 'hidden'
      }`;
    }
  }, [value, textareaRef]);

  return (
    <div className="flex flex-col">
      <label className="mb-4 text-left">{t('System prompt')}</label>
      <textarea
        ref={textareaRef}
        className="border-gray-400 focus-within:border-blue-500 max-h-[300px] w-full resize-none overflow-y-auto rounded border bg-transparent px-4 py-3 outline-none placeholder:text-secondary"
        placeholder={
          t(`Enter a prompt or type "/" to select a prompt...`) || ''
        }
        value={value}
        rows={1}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        data-qa="system-prompt"
      />

      {showPromptList && filteredPrompts.length > 0 && (
        <div>
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
          prompt={prompts[activePromptIndex]}
          variables={variables}
          onSubmit={handleSubmit}
          onClose={() => setIsModalVisible(false)}
        />
      )}
    </div>
  );
};

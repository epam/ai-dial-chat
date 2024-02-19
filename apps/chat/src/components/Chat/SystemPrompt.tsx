import {
  ChangeEvent,
  FC,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import { useTranslation } from 'next-i18next';

import { usePromptSelection } from '@/src/hooks/usePromptSelection';

import { getPromptLimitDescription } from '@/src/utils/app/modals';

import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { DEFAULT_SYSTEM_PROMPT } from '@/src/constants/default-settings';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { Spinner } from '@/src/components/Common/Spinner';

import { PromptDialog } from './ChatInput/PromptDialog';
import { PromptList } from './ChatInput/PromptList';

import debounce from 'lodash-es/debounce';

interface Props {
  maxLength: number;
  prompt: string | undefined;
  prompts: Prompt[];
  onChangePrompt: (prompt: string) => void;
}

const MAX_HEIGHT = 300;

export const SystemPrompt: FC<Props> = ({
  prompts,
  maxLength,
  prompt,
  onChangePrompt,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const promptListRef = useRef<HTMLUListElement | null>(null);

  const {
    content,
    setContent,
    setActivePromptIndex,
    setIsModalVisible,
    isModalVisible,
    activePromptIndex,
    isPromptLimitModalOpen,
    setIsPromptLimitModalOpen,
    updatePromptListVisibility,
    filteredPrompts,
    variables,
    showPromptList,
    setShowPromptList,
    handleKeyDownIfShown,
    getPrompt,
    isLoading,
  } = usePromptSelection(maxLength, prompt ?? DEFAULT_SYSTEM_PROMPT);

  const debounceOnChange = useMemo(
    () =>
      debounce(onChangePrompt, 1000, {
        leading: false,
        maxWait: 5000,
      }),
    [onChangePrompt],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;

      if (value.length > maxLength && value.length >= content.length) {
        setIsPromptLimitModalOpen(true);
        return;
      }

      setContent(value);
      updatePromptListVisibility(value);

      debounceOnChange(value);
    },
    [
      content.length,
      debounceOnChange,
      maxLength,
      setContent,
      setIsPromptLimitModalOpen,
      updatePromptListVisibility,
    ],
  );

  const handleSubmit = useCallback(
    (updatedVariables: string[]) => {
      const newContent = content?.replace(/{{(.*?)}}/g, (match, variable) => {
        const index = variables.indexOf(variable);
        return updatedVariables[index];
      });

      setContent(newContent);
      onChangePrompt(newContent);

      if (textareaRef && textareaRef.current) {
        textareaRef.current.focus();
      }
    },
    [content, setContent, onChangePrompt, variables],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (showPromptList && filteredPrompts.length > 0) {
        handleKeyDownIfShown(e);
      }
    },
    [handleKeyDownIfShown, showPromptList, filteredPrompts],
  );

  useEffect(() => {
    if (textareaRef && textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
      textareaRef.current.style.height = `${textareaRef.current?.scrollHeight}px`;
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
  }, [setShowPromptList]);

  useEffect(() => {
    if (textareaRef && textareaRef.current) {
      textareaRef.current.style.height = 'inherit'; // reset height
      const scrollHeight = textareaRef.current.scrollHeight; // then check scroll height
      textareaRef.current.style.height = `${scrollHeight}px`;
      textareaRef.current.style.overflow = `${
        scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden'
      }`;
    }
  }, [content, textareaRef]);

  return (
    <div className="flex flex-col">
      <label className="mb-4 text-left">{t('System prompt')}</label>
      <div className="relative flex flex-col">
        <textarea
          ref={textareaRef}
          className="w-full resize-none overflow-y-auto rounded border border-primary bg-transparent px-4 py-3 outline-none placeholder:text-secondary focus-within:border-accent-primary"
          placeholder={t('Type a text or «/» to use a prompt...') || ''}
          style={{ maxHeight: `${MAX_HEIGHT}px` }}
          value={content}
          rows={1}
          disabled={isLoading}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          data-qa="system-prompt"
        />
        {isLoading && (
          <span className="absolute bottom-2 right-3 rounded bg-layer-2 p-[3px]">
            <Spinner size={24} />
          </span>
        )}
      </div>

      {showPromptList && filteredPrompts.length > 0 && (
        <div>
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

      <ConfirmDialog
        isOpen={isPromptLimitModalOpen}
        heading={t('Prompt limit exceeded')}
        description={
          t(
            `Prompt limit is ${maxLength} characters.
            ${getPromptLimitDescription(content, maxLength)}`,
          ) || ''
        }
        confirmLabel={t('Confirm')}
        onClose={() => {
          setIsPromptLimitModalOpen(false);
        }}
      />

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

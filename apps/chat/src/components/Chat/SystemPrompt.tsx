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
import { useTokenizer } from '@/src/hooks/useTokenizer';

import { getPromptLimitDescription } from '@/src/utils/app/modals';

import { DialAIEntityModel } from '@/src/types/models';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { DEFAULT_SYSTEM_PROMPT } from '@/src/constants/default-ui-settings';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { Spinner } from '@/src/components/Common/Spinner';

import { DisableOverlay } from '../Common/DisableOverlay';
import { PromptList } from './ChatInput/PromptList';
import { PromptVariablesDialog } from './ChatInput/PromptVariablesDialog';
import { AdjustedTextarea } from './ChatMessage/AdjustedTextarea';

import debounce from 'lodash-es/debounce';

interface Props {
  maxTokensLength: number;
  tokenizer: DialAIEntityModel['tokenizer'];
  prompt: string | undefined;
  prompts: Prompt[];
  onChangePrompt: (prompt: string) => void;
  debounceChanges?: boolean;
  disabled?: boolean;
}

const MAX_HEIGHT = 300;

export const SystemPrompt: FC<Props> = ({
  tokenizer,
  maxTokensLength,
  prompt,
  onChangePrompt,
  debounceChanges = false,
  disabled,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const { getTokensLength } = useTokenizer(tokenizer);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const promptListRef = useRef<HTMLUListElement | null>(null);

  const debounceOnChange = useMemo(
    () =>
      debounceChanges
        ? debounce(onChangePrompt, 500, {
            maxWait: 5000,
          })
        : onChangePrompt,
    [debounceChanges, onChangePrompt],
  );

  const {
    content,
    setContent,
    addPromptContent,
    setActivePromptIndex,
    setIsModalVisible,
    isModalVisible,
    activePromptIndex,
    isPromptLimitModalOpen,
    setIsPromptLimitModalOpen,
    updatePromptListVisibility,
    filteredPrompts,
    showPromptList,
    setShowPromptList,
    handleKeyDownIfShown,
    getPrompt,
    isLoading,
    selectedPrompt,
  } = usePromptSelection(
    maxTokensLength,
    tokenizer,
    prompt ?? DEFAULT_SYSTEM_PROMPT,
    debounceOnChange,
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      const valueTokensLength = getTokensLength(value);
      const contentTokensLength = getTokensLength(content);

      if (
        valueTokensLength &&
        contentTokensLength &&
        valueTokensLength > maxTokensLength &&
        valueTokensLength >= contentTokensLength
      ) {
        setIsPromptLimitModalOpen(true);
        return;
      }

      setContent(value);
      updatePromptListVisibility(value);

      debounceOnChange(value);
    },
    [
      getTokensLength,
      content,
      maxTokensLength,
      setContent,
      updatePromptListVisibility,
      debounceOnChange,
      setIsPromptLimitModalOpen,
    ],
  );

  const handleSubmit = useCallback(
    (newContent: string) => {
      addPromptContent(newContent);
      onChangePrompt(newContent);

      if (textareaRef && textareaRef.current) {
        textareaRef.current.focus();
      }
    },
    [addPromptContent, onChangePrompt],
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

  return (
    <div className="flex flex-col">
      <label className="mb-4 text-left">{t('System prompt')}</label>
      <div className="relative flex flex-col">
        {disabled && <DisableOverlay />}
        <AdjustedTextarea
          ref={textareaRef}
          className="w-full resize-none overflow-y-auto rounded border border-primary bg-transparent px-4 py-3 outline-none placeholder:text-secondary focus-within:border-accent-primary"
          placeholder={t('Type a text or «/» to use a prompt...') || ''}
          maxHeight={MAX_HEIGHT}
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
            `Prompt limit is ${maxTokensLength} tokens. ${getPromptLimitDescription(getTokensLength(content) ?? 0, maxTokensLength)}`,
          ) || ''
        }
        confirmLabel={t('Confirm')}
        onClose={() => {
          setIsPromptLimitModalOpen(false);
        }}
      />

      {selectedPrompt && isModalVisible && (
        <PromptVariablesDialog
          prompt={selectedPrompt}
          onSubmit={handleSubmit}
          onClose={() => setIsModalVisible(false)}
        />
      )}
    </div>
  );
};

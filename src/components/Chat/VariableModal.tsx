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

import EmptyRequiredInputMessage from '../Common/EmptyRequiredInputMessage';

interface Props {
  prompt: Prompt;
  variables: string[];
  onSubmit: (updatedVariables: string[]) => void;
  onClose: () => void;
}

export const VariableModal: FC<Props> = ({
  prompt,
  variables,
  onSubmit,
  onClose,
}) => {
  const [updatedVariables, setUpdatedVariables] = useState<
    { key: string; value: string }[]
  >(
    variables
      .map((variable) => ({ key: variable, value: '' }))
      .filter(
        (item, index, array) =>
          array.findIndex((t) => t.key === item.key) === index,
      ),
  );

  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useTranslation('settings');

  const handleChange = useCallback((index: number, value: string) => {
    setUpdatedVariables((prev) => {
      const updated = [...prev];
      updated[index].value = value;
      return updated;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (updatedVariables.some((variable) => variable.value === '')) {
      alert(t('Please fill out all variables'));
      return;
    }

    onSubmit(updatedVariables.map((variable) => variable.value));
    onClose();
  }, [onClose, onSubmit, updatedVariables, t]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleSubmit, onClose],
  );

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('click', handleOutsideClick);

    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, [onClose]);

  useEffect(() => {
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onKeyDown={handleKeyDown}
    >
      <div
        ref={modalRef}
        className="inline-block max-h-[400px] overflow-y-auto rounded bg-gray-100 px-4 pb-4 pt-5 text-left align-bottom transition-all dark:bg-gray-700 sm:my-8 sm:max-h-[600px] sm:w-full sm:max-w-lg sm:p-6 sm:align-middle"
        role="dialog"
        data-qa="variable-modal"
      >
        <div
          className="mb-4 text-base font-bold"
          data-qa="variable-prompt-name"
        >
          {prompt.name}
        </div>

        {prompt.description && (
          <div className="mb-5 italic" data-qa="variable-prompt-descr">
            {prompt.description}
          </div>
        )}

        {updatedVariables.map((variable, index) => (
          <div className="mb-4" key={index}>
            <div className="font-bold">{variable.key}</div>

            <textarea
              ref={index === 0 ? nameInputRef : undefined}
              className="mt-1 w-full rounded border border-gray-400 bg-transparent px-4 py-2 placeholder:text-gray-500 hover:border-blue-500 focus:border-blue-500 focus:outline-none dark:border-gray-600"
              style={{ resize: 'none' }}
              required
              placeholder={
                t('Enter a value for {{key}}...', {
                  key: variable.key,
                }) as string
              }
              value={variable.value}
              onChange={(e) => handleChange(index, e.target.value)}
              onBlur={(e) => {
                e.target.classList.add(
                  'invalid:border-red-800',
                  'dark:invalid:border-red-400',
                );
              }}
              rows={3}
            />
            {(!variable.value || variable.value.trim().length === 0) && (
              <EmptyRequiredInputMessage text="Please fill out all variables" />
            )}
          </div>
        ))}

        <div className="mt-1 flex justify-end">
          <button
            className="rounded bg-blue-500 p-3 text-gray-100 hover:bg-blue-700 focus:border focus:border-gray-800 focus-visible:outline-none dark:focus:border-gray-200"
            onClick={handleSubmit}
            data-qa="submit-variable"
          >
            {t('Submit')}
          </button>
        </div>
      </div>
    </div>
  );
};

import {
  ChangeEvent,
  FC,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import { onBlur } from '@/src/utils/app/style-helpers';

import { Prompt } from '@/src/types/prompt';

import XMark from '../../../public/images/icons/xmark.svg';
import EmptyRequiredInputMessage from '../Common/EmptyRequiredInputMessage';

import classNames from 'classnames';

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
  const [submitted, setSubmitted] = useState(false);

  const modalRef = useRef<HTMLFormElement>(null);
  const inputsRefs = useRef<HTMLTextAreaElement[] | null[]>([]);
  const { t } = useTranslation('settings');

  const handleChange = useCallback(
    (index: number, e: ChangeEvent<HTMLTextAreaElement>) => {
      setUpdatedVariables((prev) => {
        const updated = [...prev];
        updated[index].value = e.target.value;
        return [...updated];
      });
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      setSubmitted(true);
      if (inputsRefs.current.some((el) => !el?.validity.valid)) {
        return;
      }

      onSubmit(updatedVariables.map((variable) => variable.value));
      onClose();
    },
    [onClose, onSubmit, updatedVariables],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
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

  const inputClassName = classNames('input-form', 'peer', {
    'input-invalid': submitted,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onKeyDown={handleKeyDown}
    >
      <form
        ref={modalRef}
        noValidate
        className="relative inline-block max-h-[400px] overflow-y-auto rounded bg-gray-100 px-4 pb-4 pt-5 text-left align-bottom transition-all dark:bg-gray-700 sm:my-8 sm:max-h-[600px] sm:w-full sm:max-w-lg sm:p-6 sm:align-middle"
        role="dialog"
        data-qa="variable-modal"
        onSubmit={handleSubmit}
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

        <button
          className="absolute right-2 top-2 rounded text-gray-500 hover:text-blue-700"
          onClick={onClose}
        >
          <XMark height={24} width={24} />
        </button>

        {updatedVariables.map((variable, index) => (
          <div className="mb-4" key={index}>
            <div className="mb-1 flex text-xs text-gray-500">
              {variable.key}
              <span className="ml-1 inline text-blue-500">*</span>
            </div>

            <textarea
              ref={(el) => (inputsRefs.current[index] = el)}
              className={inputClassName}
              style={{ resize: 'none' }}
              required
              title=""
              placeholder={
                t('Enter a value for {{key}}...', {
                  key: variable.key,
                }) as string
              }
              value={variable.value}
              onBlur={onBlur}
              onChange={(e) => {
                handleChange(index, e);
              }}
              rows={3}
            />
            <EmptyRequiredInputMessage text="Please fill out all variables" />
          </div>
        ))}

        <div className="mt-1 flex justify-end">
          <button
            type="submit"
            className="rounded bg-blue-500 p-3 text-gray-100 hover:bg-blue-700 focus:border focus:border-gray-800 focus-visible:outline-none dark:focus:border-gray-200"
            data-qa="submit-variable"
          >
            {t('Submit')}
          </button>
        </div>
      </form>
    </div>
  );
};

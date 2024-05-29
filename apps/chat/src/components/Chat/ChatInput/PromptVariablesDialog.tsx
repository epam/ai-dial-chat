import { IconX } from '@tabler/icons-react';
import {
  ChangeEvent,
  FC,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { parseVariablesFromContent } from '@/src/utils/app/prompts';
import { onBlur } from '@/src/utils/app/style-helpers';

import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import EmptyRequiredInputMessage from '../../Common/EmptyRequiredInputMessage';

interface Props {
  prompt: Prompt;
  onSubmit: (updatedContent: string) => void;
  onClose: () => void;
}

export const PromptVariablesDialog: FC<Props> = ({
  prompt,
  onSubmit,
  onClose,
}) => {
  const variables = useMemo(
    () => parseVariablesFromContent(prompt.content),
    [prompt.content],
  );
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
  const { t } = useTranslation(Translation.Settings);

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
      const content = prompt.content as string;

      const newContent = content.replace(/{{(.*?)}}/g, (match, variable) => {
        return updatedVariables.find((v) => v.key === variable)?.value ?? '';
      });

      onSubmit(newContent);
      onClose();
    },
    [onClose, onSubmit, prompt.content, updatedVariables],
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

  const inputClassName = classNames(
    'input-form',
    'peer',
    'rounded-primary shadow-primary placeholder:text-tertiary-bg-light focus-within:border-accent-quaternary hover:border-accent-quaternary m-0 border-secondary bg-layer-2 ',
    {
      'input-invalid': submitted,
      submitted: submitted,
    },
  );

  return (
    <div
      className="fixed inset-0 z-50 flex max-h-full items-center justify-center overflow-hidden bg-blackout p-3 md:p-5"
      onKeyDown={handleKeyDown}
    >
      <form
        ref={modalRef}
        noValidate
        className="relative inline-block max-h-full w-full overflow-y-auto rounded-[10px] bg-layer-1 px-3 py-4 text-left align-bottom transition-all md:p-6 xl:max-w-[720px] 2xl:max-w-[780px]"
        role="dialog"
        data-qa="variable-modal"
        onSubmit={handleSubmit}
      >
        <div
          className="mb-4 whitespace-pre text-base font-bold"
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
          className="text-quaternary-bg-light hover:text-primary-bg-light absolute right-2 top-2 rounded"
          onClick={onClose}
        >
          <IconX size={24} />
        </button>

        {updatedVariables.map((variable, index) => (
          <div className="mb-4" key={variable.key}>
            <div className="text-primary-bg-light mb-1 flex text-xs">
              {variable.key}
              <span className="text-quinary-bg-light inline">*</span>
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
            className="button button-primary"
            data-qa="submit-variable"
          >
            {t('Submit')}
          </button>
        </div>
      </form>
    </div>
  );
};

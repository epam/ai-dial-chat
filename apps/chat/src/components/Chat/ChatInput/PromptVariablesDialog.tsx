import { IconX } from '@tabler/icons-react';
import {
  ChangeEvent,
  FC,
  FocusEvent,
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

import { hasParentWithAttribute } from '@/src/utils/app/modals';
import { parseVariablesFromContent } from '@/src/utils/app/prompts';
import { onBlur } from '@/src/utils/app/style-helpers';

import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import Tooltip from '@/src/components/Common/Tooltip';

import { PROMPT_VARIABLE_REGEX } from '@/src/constants/folders';

import EmptyRequiredInputMessage from '../../Common/EmptyRequiredInputMessage';

interface Props {
  prompt: Prompt;
  onSubmit: (updatedContent: string) => void;
  onClose: () => void;
  ignoreOutsideClicks?: string;
}

export const PromptVariablesDialog: FC<Props> = ({
  prompt,
  onSubmit,
  onClose,
  ignoreOutsideClicks,
}) => {
  const variables = useMemo(
    () => parseVariablesFromContent(prompt.content),
    [prompt.content],
  );
  const [updatedVariables, setUpdatedVariables] = useState<
    { key: string; value: string }[]
  >(
    variables
      .map((variable) => ({ key: variable.name, value: variable.defaultValue }))
      .filter(
        (item, index, array) =>
          array.findIndex((t) => t.key === item.key) === index,
      ),
  );
  const [submitted, setSubmitted] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);

  const modalRef = useRef<HTMLFormElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputsRefs = useRef<HTMLTextAreaElement[] | null[]>([]);
  const { t } = useTranslation(Translation.Settings);

  const handleChange = useCallback(
    (index: number, e: ChangeEvent<HTMLTextAreaElement>) => {
      setUpdatedVariables((prev) => {
        const updated = [...prev];
        updated[index].value = e.target.value;
        return updated;
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

      const newContent = content.replace(
        PROMPT_VARIABLE_REGEX,
        (_, variable) => {
          return updatedVariables.find((v) => v.key === variable)?.value ?? '';
        },
      );

      onSubmit(newContent);
      onClose();
    },
    [onClose, onSubmit, prompt.content, updatedVariables],
  );

  const handleOnBlur = useCallback(
    (index: number, e: FocusEvent<HTMLTextAreaElement>) => {
      e.target.value = e.target.value.trim();
      setUpdatedVariables((prev) => {
        const updated = [...prev];
        updated[index].value = e.target.value;
        return updated;
      });
      onBlur(e);
    },
    [],
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
    if (contentRef.current) {
      const contentHeight = contentRef.current.scrollHeight;
      const maxHeight = window.innerHeight - 200;
      setIsScrollable(contentHeight > maxHeight);
    }
  }, [updatedVariables]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        ignoreOutsideClicks &&
        hasParentWithAttribute(e.target as Element, ignoreOutsideClicks)
      ) {
        return;
      }
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('click', handleOutsideClick);

    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, [ignoreOutsideClicks, onClose]);

  const inputClassName = classNames(
    'input-form',
    'peer',
    'placeholder:text-pr-grey-400 m-0 rounded-primary border-secondary bg-layer-2 shadow-primary focus-within:border-accent-quaternary hover:border-accent-quaternary ',
    {
      'input-invalid': submitted,
      submitted: submitted,
    },
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-blackout p-3 md:p-5"
      onKeyDown={handleKeyDown}
    >
      <form
        ref={modalRef}
        noValidate
        className="relative inline-block w-full rounded-secondary bg-layer-1 text-left transition-all xl:w-[570px] 2xl:w-[800px]"
        role="dialog"
        data-qa="variable-modal"
        onSubmit={handleSubmit}
      >
        <div className="text-pr-grey-white bg-pr-primary-550 flex h-[80px] items-center justify-between rounded-t-secondary py-4 pl-8 pr-4 font-medium">
          <div className="flex flex-col items-start justify-center gap-1 overflow-hidden">
            <div
              className="w-full truncate text-xl"
              data-qa="variable-prompt-name"
            >
              {prompt.name}
            </div>

            {prompt.description && (
              <Tooltip tooltip={prompt.description} triggerClassName="w-full">
                <div
                  className="w-full truncate text-xs"
                  data-qa="variable-prompt-descr"
                >
                  {prompt.description}
                </div>
              </Tooltip>
            )}
          </div>

          <button
            onClick={onClose}
            className="hover:text-pr-tertiary-500 self-start"
          >
            <IconX height={20} width={20} />
          </button>
        </div>
        <div
          ref={contentRef}
          className={classNames(
            'px-8 py-4',
            isScrollable && 'max-h-[calc(100vh-200px)] overflow-y-auto',
          )}
        >
          {updatedVariables.map((variable, index) => (
            <div className="mb-1" key={variable.key}>
              <div className="mb-1 flex text-xs font-medium text-primary-bg-light">
                <span>
                  <span className="break-all">{variable.key}</span>
                  <span className="text-pr-alert-500 inline">*</span>
                </span>
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
                onBlur={(e) => {
                handleOnBlur(index, e);
              }}
                onChange={(e) => {
                  handleChange(index, e);
                }}
                rows={3}
              />
              <EmptyRequiredInputMessage text="Please fill out all variables" />
            </div>
          ))}

          <div className="mt-1 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="button button-ghost button-medium"
              data-qa="cancel-variable"
            >
              {t('Cancel')}
            </button>
            <button
              type="submit"
              className="button button-primary button-medium"
              data-qa="submit-variable"
            >
              {t('Submit')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

import {
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { IconX } from '@tabler/icons-react';
import {
  ChangeEvent,
  FC,
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { onBlur } from '@/src/utils/app/style-helpers';

import { Prompt } from '@/src/types/prompt';

import EmptyRequiredInputMessage from '../../Common/EmptyRequiredInputMessage';

interface Props {
  prompt: Prompt;
  isOpen: boolean;
  onClose: () => void;
  onUpdatePrompt: (prompt: Prompt) => void;
}

export const PromptModal: FC<Props> = ({
  prompt,
  isOpen,
  onClose,
  onUpdatePrompt,
}) => {
  const { t } = useTranslation('promptbar');
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState(prompt.description);
  const [content, setContent] = useState(prompt.content);

  const [submitted, setSubmitted] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);

  const { refs, context } = useFloating({
    open: isOpen,
    onOpenChange: () => {
      onClose();
    },
  });
  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

  const handleClose = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      setSubmitted(false);
      onClose();
    },
    [onClose],
  );

  const nameOnChangeHandler = (e: ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const descriptionOnChangeHandler = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  };

  const contentOnChangeHandler = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  const handleSubmit = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      setSubmitted(true);

      if (!name || name.trim() === '') {
        return;
      }
      const updatedPrompt = {
        ...prompt,
        name: name.trim(),
        description: description?.trim(),
        content: (content || '').trim(),
      };

      onUpdatePrompt(updatedPrompt);
      setSubmitted(false);
      onClose();
    },
    [content, description, name, onUpdatePrompt, prompt, onClose],
  );

  const handleEnter = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        onUpdatePrompt({
          ...prompt,
          name,
          description,
          content: (content || '').trim(),
        });
        setSubmitted(false);
        onClose();
      }
    },
    [content, description, name, onUpdatePrompt, prompt, onClose],
  );

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const inputClassName = classNames('input-form', 'peer', {
    'input-invalid': submitted,
    submitted: submitted,
  });

  useEffect(() => {
    setName(prompt.name);
  }, [prompt.name]);

  return (
    <FloatingPortal id="theme-main">
      <FloatingOverlay
        lockScroll
        className="z-50 flex items-center justify-center bg-gray-900/30 p-3 dark:bg-gray-900/70 md:p-5"
        onKeyDown={handleEnter}
      >
        <FloatingFocusManager context={context} initialFocus={nameInputRef}>
          <form
            noValidate
            className="relative inline-block max-h-full w-full overflow-y-auto rounded bg-gray-100 px-3 py-4 text-left align-bottom transition-all dark:bg-gray-700 md:p-6 xl:max-h-[800px] xl:max-w-[720px] 2xl:max-w-[1000px]"
            role="dialog"
            ref={refs.setFloating}
            {...getFloatingProps()}
            data-qa="prompt-modal"
          >
            <button
              type="button"
              role="button"
              className="absolute right-2 top-2 rounded text-gray-500 hover:text-blue-700"
              onClick={handleClose}
            >
              <IconX size={24} />
            </button>
            <div className="flex justify-between pb-4 text-base font-bold">
              {t('Edit prompt')}
            </div>

            <div className="mb-4">
              <label
                className="mb-1 flex text-xs text-gray-500"
                htmlFor="promptName"
              >
                {t('Name')}
                <span className="ml-1 inline text-blue-500">*</span>
              </label>
              <input
                ref={nameInputRef}
                name="promptName"
                className={inputClassName}
                placeholder={t('A name for your prompt.') || ''}
                value={name}
                required
                type="text"
                onBlur={onBlur}
                onChange={nameOnChangeHandler}
                data-qa="prompt-name"
              />
              <EmptyRequiredInputMessage />
            </div>

            <div className="mb-4">
              <label
                className="mb-1 flex text-xs text-gray-500"
                htmlFor="description"
              >
                {t('Description')}
              </label>
              <textarea
                ref={descriptionInputRef}
                name="description"
                className={inputClassName}
                style={{ resize: 'none' }}
                placeholder={t('A description for your prompt.') || ''}
                value={description}
                onChange={descriptionOnChangeHandler}
                rows={3}
                data-qa="prompt-descr"
              />
            </div>
            <div className="mb-5">
              <label
                className="mb-1 flex text-xs text-gray-500"
                htmlFor="content"
              >
                {t('Prompt')}
              </label>
              <textarea
                ref={contentInputRef}
                name="content"
                className={inputClassName}
                style={{ resize: 'none' }}
                placeholder={
                  t(
                    'Prompt content. Use {{}} to denote a variable. Ex: {{name}} is a {{adjective}} {{noun}}',
                  ) || ''
                }
                value={content}
                onChange={contentOnChangeHandler}
                rows={10}
                data-qa="prompt-value"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="w-full rounded bg-blue-500 p-3 text-gray-100 hover:bg-blue-700 focus:border focus:border-gray-800 focus-visible:outline-none dark:focus:border-gray-200 md:w-fit"
                data-qa="save-prompt"
                onClick={handleSubmit}
              >
                {t('Save')}
              </button>
            </div>
          </form>
        </FloatingFocusManager>
      </FloatingOverlay>
    </FloatingPortal>
  );
};

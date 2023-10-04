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

import XMark from '../../../../public/images/icons/xmark.svg';
import EmptyRequiredInputMessage from '../../Common/EmptyRequiredInputMessage';

import classNames from 'classnames';

interface Props {
  prompt: Prompt;
  onClose: () => void;
  onUpdatePrompt: (prompt: Prompt) => void;
}

export const PromptModal: FC<Props> = ({ prompt, onClose, onUpdatePrompt }) => {
  const { t } = useTranslation('promptbar');
  const [name, setName] = useState(prompt.name);
  const [description, setDescription] = useState(prompt.description);
  const [content, setContent] = useState(prompt.content);

  const [submitted, setSubmitted] = useState(false);

  const modalRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);

  const handleClose = useCallback(() => {
    setSubmitted(false);
    onClose();
  }, [onClose]);

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
    (e: FormEvent) => {
      e.preventDefault();
      setSubmitted(true);

      if (!name || name.trim() === '') {
        return;
      }
      const updatedPrompt = {
        ...prompt,
        name,
        description,
        content: content.trim(),
      };

      onUpdatePrompt(updatedPrompt);
      handleClose();
    },
    [content, description, name, onUpdatePrompt, prompt, handleClose],
  );

  const handleEnter = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        onUpdatePrompt({
          ...prompt,
          name,
          description,
          content: content.trim(),
        });
        handleClose();
      }
    },
    [content, description, name, onUpdatePrompt, prompt, handleClose],
  );

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        window.addEventListener('mouseup', handleMouseUp);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mouseup', handleMouseUp);
      handleClose();
    };

    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [modalRef, handleClose]);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const inputClassName = classNames('input-form', 'peer', {
    'input-invalid': submitted,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70"
      onKeyDown={handleEnter}
    >
      <form
        ref={modalRef}
        noValidate
        className="relative inline-block max-h-[600px] overflow-y-auto rounded bg-gray-100 p-4 text-left align-bottom transition-all dark:bg-gray-700 sm:my-8 sm:max-h-fit sm:w-full sm:max-w-lg sm:p-6 sm:align-middle"
        role="dialog"
        data-qa="prompt-modal"
      >
        <button
          type="button"
          role="button"
          className="absolute right-2 top-2 rounded text-gray-500 hover:text-blue-700"
          onClick={handleClose}
        >
          <XMark height={24} width={24} />
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
            pattern="(?:\s+)*\w+(?:\s+\w+)*(?:\s+)*"
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
          <label className="mb-1 flex text-xs text-gray-500" htmlFor="content">
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
            className="rounded bg-blue-500 p-3 text-gray-100 hover:bg-blue-700 focus:border focus:border-gray-800 focus-visible:outline-none dark:focus:border-gray-200"
            data-qa="save-prompt"
            onClick={handleSubmit}
          >
            {t('Save')}
          </button>
        </div>
      </form>
    </div>
  );
};

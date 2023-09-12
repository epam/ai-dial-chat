import { FC, KeyboardEvent, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { Prompt } from '@/src/types/prompt';

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

  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleEnter = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      onUpdatePrompt({ ...prompt, name, description, content: content.trim() });
      onClose();
    }
  };

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        window.addEventListener('mouseup', handleMouseUp);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mouseup', handleMouseUp);
      onClose();
    };

    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [onClose]);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70"
      onKeyDown={handleEnter}
    >
      <div className="fixed inset-0 z-10 overflow-hidden">
        <div className="flex min-h-screen items-center justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0">
          <div
            className="hidden sm:inline-block sm:h-screen sm:align-middle"
            aria-hidden="true"
          />

          <div
            ref={modalRef}
            className="inline-block max-h-[400px] overflow-y-auto rounded border border-gray-300 bg-gray-100 px-4 pb-4 pt-5 text-left align-bottom shadow-xl transition-all dark:bg-gray-700 sm:my-8 sm:max-h-[600px] sm:w-full sm:max-w-lg sm:p-6 sm:align-middle"
            role="dialog"
            data-qa="prompt-modal"
          >
            <div className="text-sm font-bold">{t('Name')}</div>
            <input
              ref={nameInputRef}
              className="mt-2 w-full rounded border px-4 py-2 shadow focus:outline-none dark:bg-gray-700"
              placeholder={t('A name for your prompt.') || ''}
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-qa="prompt-name"
            />

            <div className="mt-6 text-sm font-bold">{t('Description')}</div>
            <textarea
              className="mt-2 w-full rounded border px-4 py-2 shadow placeholder:text-gray-500 focus:outline-none dark:bg-gray-700"
              style={{ resize: 'none' }}
              placeholder={t('A description for your prompt.') || ''}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              data-qa="prompt-descr"
            />

            <div className="mt-6 text-sm font-bold">{t('Prompt')}</div>
            <textarea
              className="mt-2 w-full rounded border px-4 py-2 shadow focus:outline-none dark:bg-gray-700"
              style={{ resize: 'none' }}
              placeholder={
                t(
                  'Prompt content. Use {{}} to denote a variable. Ex: {{name}} is a {{adjective}} {{noun}}',
                ) || ''
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              data-qa="prompt-value"
            />

            <button
              type="button"
              className="mt-6 w-full rounded border px-4 py-2 shadow focus:outline-none"
              onClick={() => {
                const updatedPrompt = {
                  ...prompt,
                  name,
                  description,
                  content: content.trim(),
                };

                onUpdatePrompt(updatedPrompt);
                onClose();
              }}
              data-qa="save-prompt"
            >
              {t('Save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

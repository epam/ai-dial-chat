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

import {
  isEntityNameOnSameLevelUnique,
  prepareEntityName,
} from '@/src/utils/app/common';
import { notAllowedSymbolsRegex } from '@/src/utils/app/file';
import { onBlur } from '@/src/utils/app/style-helpers';

import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors } from '@/src/store/prompts/prompts.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { NotFoundEntity } from '@/src/components/Common/NotFoundEntity';

import EmptyRequiredInputMessage from '../../Common/EmptyRequiredInputMessage';
import Loader from '../../Common/Loader';
import Modal from '../../Common/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUpdatePrompt: (prompt: Prompt) => void;
}

export const PromptModal: FC<Props> = ({ isOpen, onClose, onUpdatePrompt }) => {
  const dispatch = useAppDispatch();

  const selectedPrompt = useAppSelector(PromptsSelectors.selectSelectedPrompt);
  const isLoading = useAppSelector(PromptsSelectors.isPromptLoading);
  const allPrompts = useAppSelector(PromptsSelectors.selectPrompts);

  const { t } = useTranslation(Translation.PromptBar);
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState(
    selectedPrompt?.description || '',
  );
  const [content, setContent] = useState(selectedPrompt?.content || '');

  const [submitted, setSubmitted] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);

  const handleClose = useCallback(() => {
    setSubmitted(false);
    onClose();
  }, [onClose]);

  const nameOnChangeHandler = (e: ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value.replaceAll(notAllowedSymbolsRegex, ''));
  };

  const descriptionOnChangeHandler = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  };

  const contentOnChangeHandler = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  const updatePrompt = useCallback(
    (selectedPrompt: Prompt) => {
      const newName = prepareEntityName(name);
      setName(newName);

      if (!newName) return;

      if (!isEntityNameOnSameLevelUnique(newName, selectedPrompt, allPrompts)) {
        dispatch(
          UIActions.showToast({
            message: t(
              `Prompt with name "${newName}" already exists in this folder.`,
            ),
            type: 'error',
          }),
        );

        return;
      }

      onUpdatePrompt({
        ...selectedPrompt,
        name: newName,
        description: description?.trim(),
        content: content.trim(),
      });
      setSubmitted(false);
      onClose();
    },
    [
      allPrompts,
      content,
      description,
      dispatch,
      name,
      onClose,
      onUpdatePrompt,
      t,
    ],
  );

  const handleSubmit = useCallback(
    (e: MouseEvent<HTMLButtonElement>, selectedPrompt: Prompt) => {
      e.preventDefault();
      e.stopPropagation();

      setSubmitted(true);

      updatePrompt(selectedPrompt);
    },
    [updatePrompt],
  );

  const handleEnter = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, selectedPrompt: Prompt) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        updatePrompt(selectedPrompt);
      }
    },
    [updatePrompt],
  );

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  useEffect(() => {
    setDescription(selectedPrompt?.description || '');
    setContent(selectedPrompt?.content || '');
  }, [selectedPrompt]);

  const inputClassName = classNames('input-form', 'peer', {
    'input-invalid': submitted,
    submitted: submitted,
  });

  useEffect(() => {
    setName(selectedPrompt?.name || '');
  }, [selectedPrompt?.name]);

  return (
    <Modal
      portalId="theme-main"
      containerClassName="inline-block w-full overflow-y-auto px-3 py-4 align-bottom transition-all md:p-6 xl:max-h-[800px] xl:max-w-[720px] 2xl:max-w-[1000px]"
      dataQa="prompt-modal"
      isOpen={isOpen}
      onClose={handleClose}
      onKeyDownOverlay={(e) => {
        if (selectedPrompt) handleEnter(e, selectedPrompt);
      }}
      initialFocus={nameInputRef}
    >
      <div className="flex justify-between pb-4 text-base font-bold">
        {t('Edit prompt')}
      </div>

      {!isLoading ? (
        selectedPrompt ? (
          <>
            <div className="mb-4">
              <label
                className="mb-1 flex text-xs text-secondary"
                htmlFor="promptName"
              >
                {t('Name')}
                <span className="ml-1 inline text-accent-primary">*</span>
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
                className="mb-1 flex text-xs text-secondary"
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
                className="mb-1 flex text-xs text-secondary"
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
                className="button button-primary"
                data-qa="save-prompt"
                onClick={(e) => handleSubmit(e, selectedPrompt)}
              >
                {t('Save')}
              </button>
            </div>
          </>
        ) : (
          <NotFoundEntity entity={t('Prompt')} />
        )
      ) : (
        <Loader containerClassName="h-[540px] max-h-full" />
      )}
    </Modal>
  );
};

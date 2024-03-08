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
  isEntityNameInvalid,
  isEntityNameOnSameLevelUnique,
  prepareEntityName,
} from '@/src/utils/app/common';
import { notAllowedSymbolsRegex } from '@/src/utils/app/file';
import { onBlur } from '@/src/utils/app/style-helpers';

import { ModalState } from '@/src/types/modal';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors } from '@/src/store/prompts/prompts.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { NotFoundEntity } from '@/src/components/Common/NotFoundEntity';

import EmptyRequiredInputMessage from '../../Common/EmptyRequiredInputMessage';
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
  const [isConfirmDialog, setIsConfirmDialog] = useState(false);
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
      const newName = prepareEntityName(name, true);
      setName(newName);

      if (!newName) return;

      if (!isEntityNameOnSameLevelUnique(newName, selectedPrompt, allPrompts)) {
        dispatch(
          UIActions.showErrorToast(
            t('Prompt with name "{{newName}}" already exists in this folder.', {
              ns: 'prompt',
              newName,
            }),
          ),
        );

        return;
      }

      if (isEntityNameInvalid(newName)) {
        dispatch(
          UIActions.showErrorToast(
            t('Using a dot at the end of a name is not permitted.'),
          ),
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

      if (selectedPrompt.isShared && selectedPrompt.name !== name) {
        setIsConfirmDialog(true);
        return;
      }

      updatePrompt(selectedPrompt);
    },
    [name, updatePrompt],
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
      state={
        isOpen
          ? isLoading
            ? ModalState.LOADING
            : ModalState.OPENED
          : ModalState.CLOSED
      }
      heading={t('Edit prompt')}
      onClose={handleClose}
      onKeyDownOverlay={(e) => {
        if (selectedPrompt) handleEnter(e, selectedPrompt);
      }}
      initialFocus={nameInputRef}
    >
      {selectedPrompt ? (
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
          <ConfirmDialog
            isOpen={isConfirmDialog}
            heading={t('Confirm renaming prompt')}
            confirmLabel={t('Rename')}
            cancelLabel={t('Cancel')}
            description={
              t(
                'Renaming will stop sharing and other users will no longer see this conversation.',
              ) || ''
            }
            onClose={(result) => {
              setIsConfirmDialog(false);
              if (result) {
                updatePrompt({
                  ...selectedPrompt,
                  isShared: false,
                });
                setSubmitted(false);
                onClose();
              }
            }}
          />
        </>
      ) : (
        <NotFoundEntity entity={t('Prompt')} />
      )}
    </Modal>
  );
};

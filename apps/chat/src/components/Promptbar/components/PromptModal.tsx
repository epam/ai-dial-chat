import { IconX } from '@tabler/icons-react';
import {
  ChangeEvent,
  FC,
  FocusEvent,
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
  doesHaveDotsInTheEnd,
  isEntityNameOnSameLevelUnique,
  prepareEntityName,
  trimEndDots,
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
import Tooltip from '../../Common/Tooltip';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUpdatePrompt: (prompt: Prompt) => void;
}

export const PromptModal: FC<Props> = ({ isOpen, onClose, onUpdatePrompt }) => {
  const dispatch = useAppDispatch();
  const selectedPrompt = useAppSelector(
    PromptsSelectors.selectSelectedOrNewPrompt,
  );
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
  const [isDotError, setIsDotError] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);

  const handleClose = useCallback(() => {
    setSubmitted(false);
    onClose();
  }, [onClose]);

  const nameOnChangeHandler = (e: ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value.replaceAll(notAllowedSymbolsRegex, '');
    setIsDotError(doesHaveDotsInTheEnd(newName));
    setName(newName);
  };

  const nameOnBlurHandler = (e: FocusEvent<HTMLInputElement>) => {
    setName(prepareEntityName(e.target.value, { forRenaming: true }));
    onBlur(e);
  };

  const descriptionOnChangeHandler = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  };

  const contentOnChangeHandler = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  const contentOnBlurHandler = (e: FocusEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value.trim());
    onBlur(e);
  };

  const updatePrompt = useCallback(
    (selectedPrompt: Prompt) => {
      onUpdatePrompt({
        ...selectedPrompt,
        name: trimEndDots(name),
        description: description?.trim(),
        content: content.trim(),
      });
      setSubmitted(false);
      onClose();
    },
    [content, description, name, onClose, onUpdatePrompt],
  );

  const handleRename = useCallback(
    (selectedPrompt: Prompt) => {
      setSubmitted(true);

      const newName = prepareEntityName(name, { forRenaming: true });
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

      if (doesHaveDotsInTheEnd(newName)) {
        dispatch(
          UIActions.showErrorToast(
            t('Using a dot at the end of a name is not permitted.'),
          ),
        );
        return;
      }

      if (selectedPrompt.isShared && selectedPrompt.name !== newName) {
        setIsConfirmDialog(true);
        return;
      }

      updatePrompt(selectedPrompt);
    },
    [allPrompts, dispatch, name, t, updatePrompt],
  );

  const handleSubmit = useCallback(
    (e: MouseEvent<HTMLButtonElement>, selectedPrompt: Prompt) => {
      e.preventDefault();
      e.stopPropagation();

      handleRename(selectedPrompt);
    },
    [handleRename],
  );

  const handleEnter = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, selectedPrompt: Prompt) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        handleRename(selectedPrompt);
      }
    },
    [handleRename],
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

  const saveDisabled =
    !prepareEntityName(name, { forRenaming: true }) || !content.trim();

  return (
    <Modal
      portalId="theme-main"
      containerClassName="inline-block w-full overflow-y-auto bg-layer-1 px-3 py-4 align-bottom transition-all md:p-6 xl:max-h-[800px] xl:max-w-[720px] 2xl:max-w-[1000px]"
      dataQa="prompt-modal"
      hideClose
      state={
        isOpen
          ? isLoading
            ? ModalState.LOADING
            : ModalState.OPENED
          : ModalState.CLOSED
      }
      heading={
        <div className="flex justify-between pb-4 text-xl font-medium text-primary-bg-light ">
          {t('Edit prompt')}
          <button
            onClick={onClose}
            className="text-quaternary-bg-light hover:text-primary-bg-light"
            data-qa="close-edit-prompt"
          >
            <IconX height={24} width={24} />
          </button>
        </div>
      }
      onClose={handleClose}
      onKeyDownOverlay={(e) => {
        if (selectedPrompt && !saveDisabled) handleEnter(e, selectedPrompt);
      }}
      initialFocus={nameInputRef}
    >
      {selectedPrompt ? (
        <>
          <div className="mb-4">
            <label
              className="mb-1 flex text-xs text-primary-bg-light"
              htmlFor="promptName"
            >
              {t('Name')}
              <span className="inline text-quinary-bg-light">*</span>
            </label>
            <input
              ref={nameInputRef}
              name="promptName"
              className={classNames(
                inputClassName,
                'm-0 rounded-primary border-secondary bg-layer-2 shadow-primary placeholder:text-tertiary-bg-light focus-within:border-accent-quaternary hover:border-accent-quaternary',
                isDotError &&
                  'border-error hover:border-error focus:border-error',
              )}
              placeholder={t('A name for your prompt.') || ''}
              value={name}
              required
              type="text"
              onBlur={nameOnBlurHandler}
              onChange={nameOnChangeHandler}
              data-qa="prompt-name"
            />
            <EmptyRequiredInputMessage
              isShown={isDotError}
              text={
                (isDotError
                  ? t('Using a dot at the end of a name is not permitted.')
                  : t('Please fill in all required fields')) || ''
              }
            />
          </div>

          <div className="mb-4">
            <label
              className="mb-1 flex text-xs text-primary-bg-light"
              htmlFor="description"
            >
              {t('Description')}
            </label>
            <textarea
              ref={descriptionInputRef}
              name="description"
              className={classNames(
                inputClassName,
                'm-0 rounded-primary border-secondary bg-layer-2 shadow-primary placeholder:text-tertiary-bg-light focus-within:border-accent-quaternary hover:border-accent-quaternary',
              )}
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
              className="mb-1 flex text-xs text-primary-bg-light"
              htmlFor="content"
            >
              {t('Prompt')}
              <span className="inline text-quinary-bg-light">*</span>
            </label>
            <textarea
              ref={contentInputRef}
              name="content"
              className={classNames(
                inputClassName,
                'm-0 rounded-primary border-secondary bg-layer-2 shadow-primary placeholder:text-tertiary-bg-light focus-within:border-accent-quaternary hover:border-accent-quaternary',
              )}
              style={{ resize: 'none' }}
              placeholder={
                t(
                  'Prompt content. Use {{}} to denote a variable. Ex: {{name}} is a {{adjective}} {{noun}}',
                ) || ''
              }
              value={content}
              onChange={contentOnChangeHandler}
              onBlur={contentOnBlurHandler}
              rows={10}
              data-qa="prompt-value"
              required
            />
            <EmptyRequiredInputMessage />
          </div>
          <div className="flex justify-end">
            <Tooltip
              isTriggerClickable
              tooltip={t('Please fill in all required fields')}
              hideTooltip={!saveDisabled}
            >
              <button
                type="submit"
                className="button button-primary"
                data-qa="save-prompt"
                onClick={(e) => handleSubmit(e, selectedPrompt)}
                disabled={saveDisabled}
              >
                {t('Save')}
              </button>
            </Tooltip>
          </div>
          <ConfirmDialog
            isOpen={isConfirmDialog}
            heading={t('Confirm renaming prompt')}
            confirmLabel={t('Rename')}
            cancelLabel={t('Cancel')}
            description={
              t(
                'Renaming will stop sharing and other users will no longer see this prompt.',
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

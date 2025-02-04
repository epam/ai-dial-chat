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

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

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

import { NotFoundEntity } from '@/src/components/Common/NotFoundEntity';

import EmptyRequiredInputMessage from '../../Common/EmptyRequiredInputMessage';
import { Modal } from '../../Common/Modal';
import Tooltip from '../../Common/Tooltip';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUpdatePrompt: (oldPrompt: Prompt, newPrompt: Prompt) => void;
  onCreatePrompt: (prompt: Prompt) => void;
}

export const PromptModal: FC<Props> = ({
  isOpen,
  onClose,
  onUpdatePrompt,
  onCreatePrompt,
}) => {
  const { t } = useTranslation(Translation.PromptBar);

  const dispatch = useAppDispatch();

  const isNewPromptCreating = useAppSelector(
    PromptsSelectors.selectIsNewPromptCreating,
  );
  const selectedPrompt = useAppSelector(
    PromptsSelectors.selectSelectedOrNewPrompt,
  );
  const isLoading = useAppSelector(PromptsSelectors.isPromptLoading);
  const allPrompts = useAppSelector(PromptsSelectors.selectPrompts);

  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState(
    selectedPrompt?.description || '',
  );
  const [content, setContent] = useState(selectedPrompt?.content || '');
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
              ns: Translation.PromptBar,
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

      const updatedPrompt = {
        ...selectedPrompt,
        name: trimEndDots(name),
        description: description?.trim(),
        content: content.trim(),
      };

      if (isNewPromptCreating) {
        onCreatePrompt(updatedPrompt);
      } else {
        onUpdatePrompt(selectedPrompt, updatedPrompt);
      }

      setSubmitted(false);
      onClose();
    },
    [
      allPrompts,
      content,
      description,
      dispatch,
      isNewPromptCreating,
      name,
      onClose,
      onCreatePrompt,
      onUpdatePrompt,
      t,
    ],
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

  const inputClassName = classNames('input-form peer mx-0', {
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
      containerClassName="flex flex-col gap-4 inline-block w-full overflow-y-auto px-3 py-4 align-bottom transition-all md:p-6 xl:max-h-[800px] xl:max-w-[720px] 2xl:max-w-[1000px]"
      dataQa="prompt-modal"
      state={
        isOpen
          ? isLoading
            ? ModalState.LOADING
            : ModalState.OPENED
          : ModalState.CLOSED
      }
      onClose={handleClose}
      onKeyDownOverlay={(e) => {
        if (selectedPrompt && !saveDisabled) handleEnter(e, selectedPrompt);
      }}
      initialFocus={nameInputRef}
    >
      {selectedPrompt ? (
        <>
          <div className="flex justify-between">
            <h2 className="text-base font-semibold">{t('Edit prompt')}</h2>
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto">
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
                className={classNames(
                  isDotError &&
                    'border-error hover:border-error focus:border-error',
                  inputClassName,
                )}
                placeholder={t('A name for your prompt.')}
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
                  isDotError
                    ? t('Using a dot at the end of a name is not permitted.')
                    : t('Please fill in all required fields')
                }
              />
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
                placeholder={t('A description for your prompt.')}
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
                <span className="ml-1 inline text-accent-primary">*</span>
              </label>
              <textarea
                ref={contentInputRef}
                name="content"
                className={inputClassName}
                style={{ resize: 'none' }}
                placeholder={t(
                  'Prompt content. Use {{}} to denote a variable.\nEx: {{name|defaultValue}} is a {{adjective}} {{noun|defaultValue}}',
                )}
                value={content}
                onChange={contentOnChangeHandler}
                onBlur={contentOnBlurHandler}
                rows={10}
                data-qa="prompt-value"
                required
              />
              <EmptyRequiredInputMessage />
            </div>
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
        </>
      ) : (
        <NotFoundEntity entity={t('Prompt')} />
      )}
    </Modal>
  );
};

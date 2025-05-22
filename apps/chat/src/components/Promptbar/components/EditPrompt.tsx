import { IconX } from '@tabler/icons-react';
import {
  ChangeEvent,
  FC,
  FocusEvent,
  MouseEvent,
  useCallback,
  useEffect,
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
import { arePromptsFieldsTheSame } from '@/src/utils/app/prompts';
import { onBlur } from '@/src/utils/app/style-helpers';

import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors } from '@/src/store/selectors';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { EmptyRequiredInputMessage } from '@/src/components/Common/EmptyRequiredInputMessage';
import { Tooltip } from '@/src/components/Common/Tooltip';

interface Props {
  prompt: Prompt;
  onEdit: (editedPrompt: Prompt) => void;
  onClose: () => void;
}

export const EditPrompt: FC<Props> = ({ prompt, onEdit, onClose }) => {
  const { t } = useTranslation(Translation.PromptBar);

  const dispatch = useAppDispatch();

  const allPrompts = useAppSelector(PromptsSelectors.selectPrompts);

  const [name, setName] = useState<string>(prompt.name ?? '');
  const [description, setDescription] = useState(prompt?.description ?? '');
  const [content, setContent] = useState(prompt?.content ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [isDotError, setIsDotError] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

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

  const handleEdit = useCallback(
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

      onEdit({
        ...selectedPrompt,
        name: trimEndDots(name),
        description: description?.trim(),
        content: content.trim(),
      });

      setSubmitted(false);
    },
    [allPrompts, content, description, dispatch, name, onEdit, t],
  );

  const handleSubmit = useCallback(
    (e: MouseEvent<HTMLButtonElement>, selectedPrompt: Prompt) => {
      e.preventDefault();
      e.stopPropagation();

      handleEdit(selectedPrompt);
    },
    [handleEdit],
  );

  const inputClassName = classNames('input-form peer mx-0', {
    'input-invalid': submitted,
    submitted: submitted,
  });
  const saveDisabled =
    !prepareEntityName(name, { forRenaming: true }) || !content.trim();

  const handleEnter = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !saveDisabled) {
        e.preventDefault();
        e.stopPropagation();
        handleEdit(prompt);
      }
    },
    [handleEdit, prompt, saveDisabled],
  );

  const handleConfirmClose = useCallback(
    (isConfirmed: boolean) => {
      if (isConfirmed) {
        handleEdit(prompt);
      } else {
        onClose();
      }

      setConfirmClose(false);
    },
    [handleEdit, onClose, prompt],
  );

  const handleEditClose = useCallback(() => {
    if (arePromptsFieldsTheSame(prompt, { name, description, content })) {
      setConfirmClose(true);
    } else {
      onClose();
    }
  }, [content, description, name, onClose, prompt]);

  useEffect(() => {
    window.addEventListener('keydown', handleEnter);

    return () => {
      window.removeEventListener('keydown', handleEnter);
    };
  }, [handleEnter]);

  return (
    <>
      <button
        type="button"
        role="button"
        className="absolute right-2 top-2 rounded text-secondary hover:text-accent-primary"
        onClick={handleEditClose}
      >
        <IconX height={24} width={24} />
      </button>
      <div className="flex flex-col gap-4 overflow-y-auto px-3 md:px-6">
        <div>
          <label
            className="mb-1 flex text-xs text-secondary"
            htmlFor="promptName"
          >
            {t('Name')}
            <span className="ml-1 inline text-accent-primary">*</span>
          </label>
          <input
            autoFocus
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
            text={t(
              isDotError
                ? 'Using a dot at the end of a name is not permitted.'
                : 'Please fill in all required fields',
            )}
          />
        </div>

        <div>
          <label
            className="mb-1 flex text-xs text-secondary"
            htmlFor="description"
          >
            {t('Description')}
          </label>
          <textarea
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
        <div>
          <label className="mb-1 flex text-xs text-secondary" htmlFor="content">
            {t('Prompt')}
            <span className="ml-1 inline text-accent-primary">*</span>
          </label>
          <textarea
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
      <div className="flex justify-end px-3 md:px-6">
        <Tooltip
          isTriggerClickable
          tooltip={t('Please fill in all required fields')}
          hideTooltip={!saveDisabled}
        >
          <button
            type="submit"
            className="button button-primary"
            data-qa="save-prompt"
            onClick={(e) => handleSubmit(e, prompt)}
            disabled={saveDisabled}
          >
            {t('Save')}
          </button>
        </Tooltip>
      </div>
      {confirmClose && (
        <ConfirmDialog
          isOpen
          heading={t('Unsaved changes')}
          description={t(
            'There are unsaved changes. Do you want to save them before closing?',
          )}
          confirmLabel={t('Save')}
          cancelLabel={t("Don't save")}
          onClose={handleConfirmClose}
        />
      )}
    </>
  );
};

import {
  IconCircleCheckFilled,
  IconClipboardCopy,
  IconHelpCircle,
} from '@tabler/icons-react';
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
import {
  areSomePromptsFieldsChanged,
  generateSkillContent,
  isValidSkillContent,
} from '@/src/utils/app/prompts';
import { onBlur } from '@/src/utils/app/style-helpers';

import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors, UISelectors } from '@/src/store/selectors';

import { PromptBarI18nKeys } from '@/src/constants/i18n';

import { CloseButtonSmall } from '@/src/components/Common/CloseButtons';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { EmptyRequiredInputMessage } from '@/src/components/Common/EmptyRequiredInputMessage';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { DialLinkButton, DialPrimaryButton } from '@epam/ai-dial-ui-kit';

interface Props {
  prompt: Prompt;
  onEdit: (editedPrompt: Prompt) => void;
  onClose: () => void;
}

export const EditPrompt: FC<Props> = ({ prompt, onEdit, onClose }) => {
  const { t } = useTranslation(Translation.PromptBar);

  const dispatch = useAppDispatch();

  const allPrompts = useAppSelector(PromptsSelectors.selectPrompts);

  const { isSelectedPromptIsSkill } = useAppSelector(
    PromptsSelectors.selectSelectedPromptId,
  );

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
          UIActions.showErrorToast({
            message: t(PromptBarI18nKeys.NewNameExistsInThisFolder, {
              ns: Translation.PromptBar,
              newName,
            }),
          }),
        );
        return;
      }

      if (doesHaveDotsInTheEnd(newName)) {
        dispatch(
          UIActions.showErrorToast({
            message: t(
              PromptBarI18nKeys.UsingADotAtTheEndOfANameIsNotPermitted,
            ),
          }),
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

  const handleAddAgentSkill = useCallback(() => {
    setContent(generateSkillContent());
  }, []);

  const allowEnterClick = useAppSelector(UISelectors.selectAllowEnterToSend);

  const handleEnter = useCallback(
    (e: KeyboardEvent) => {
      if (!allowEnterClick(e)) {
        return;
      }

      const isContentTextarea =
        e.target instanceof HTMLTextAreaElement && e.target.name === 'content';

      if (!saveDisabled || isContentTextarea) {
        e.preventDefault();
        e.stopPropagation();
      }

      if (!saveDisabled) {
        handleEdit(prompt);
      }
    },
    [allowEnterClick, handleEdit, prompt, saveDisabled],
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
    if (areSomePromptsFieldsChanged(prompt, { name, description, content })) {
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
      <CloseButtonSmall
        className="absolute right-2 top-2"
        onClick={handleEditClose}
      />

      <div className="flex flex-col gap-4 overflow-y-auto px-3 md:px-6">
        <div>
          <label
            className="mb-1 flex text-xs text-secondary"
            htmlFor="promptName"
          >
            {t(PromptBarI18nKeys.Name)}
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
            placeholder={t(PromptBarI18nKeys.NamePlaceholder)}
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
                ? PromptBarI18nKeys.UsingADotAtTheEndOfANameIsNotPermitted
                : PromptBarI18nKeys.PleaseFillInAllRequiredFields,
            )}
          />
        </div>

        <div>
          <label
            className="mb-1 flex text-xs text-secondary"
            htmlFor="description"
          >
            {t(PromptBarI18nKeys.Description)}
          </label>
          <textarea
            name="description"
            className={inputClassName}
            style={{ resize: 'none' }}
            placeholder={t(PromptBarI18nKeys.DescriptionPlaceholder)}
            value={description}
            onChange={descriptionOnChangeHandler}
            rows={3}
            data-qa="prompt-descr"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-secondary">
            <label className="text-xs" htmlFor="content">
              {t(PromptBarI18nKeys.Prompt)}
              <span className="ml-1 inline text-accent-primary">*</span>
            </label>
            {isSelectedPromptIsSkill && (
              <span className="flex items-center">
                {isValidSkillContent(content) ? (
                  <span className="mr-2 flex items-center gap-2 text-accent-secondary">
                    <IconCircleCheckFilled size={16} />
                    {t(PromptBarI18nKeys.ValidAgentSkill)}
                  </span>
                ) : (
                  <DialLinkButton
                    className="flex items-center gap-2 text-accent-primary hover:opacity-70"
                    onClick={handleAddAgentSkill}
                    iconBefore={<IconClipboardCopy size={20} />}
                    label={t(PromptBarI18nKeys.AddAgentSkill)}
                  />
                )}
                <Tooltip tooltip={t(PromptBarI18nKeys.AgentSkillHint)}>
                  <IconHelpCircle
                    size={16}
                    className="cursor-help text-secondary"
                  />
                </Tooltip>
              </span>
            )}
          </div>
          <textarea
            name="content"
            className={inputClassName}
            style={{ resize: 'none' }}
            placeholder={t(PromptBarI18nKeys.ContentUseVariables)}
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
        <DialPrimaryButton
          tooltipProps={{
            isTriggerClickable: true,
            tooltip: t(PromptBarI18nKeys.PleaseFillInAllRequiredFields),
            hideTooltip: !saveDisabled,
          }}
          type="submit"
          data-qa="save-prompt"
          onClick={(e) => handleSubmit(e, prompt)}
          disabled={saveDisabled}
          label={t(PromptBarI18nKeys.Save)}
        />
      </div>
      {confirmClose && (
        <ConfirmDialog
          isOpen
          heading={t(PromptBarI18nKeys.UnsavedChanges)}
          description={t(PromptBarI18nKeys.UnsavedChangesCaption)}
          confirmLabel={t(PromptBarI18nKeys.Save)}
          cancelLabel={t(PromptBarI18nKeys.NotSave)}
          onClose={handleConfirmClose}
        />
      )}
    </>
  );
};

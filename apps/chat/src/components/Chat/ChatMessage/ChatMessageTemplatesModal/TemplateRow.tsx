import { IconTrashX } from '@tabler/icons-react';
import {
  ChangeEvent,
  FocusEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isSmallScreen } from '@/src/utils/app/mobile';
import { templateMatchContent } from '@/src/utils/app/prompts';

import { Translation } from '@/src/types/translation';

import { PROMPT_VARIABLE_REGEX_TEST } from '@/src/constants/folders';
import { ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { TemplateInput } from './TemplateInput';

interface TemplateRowProps {
  index: number;
  content: string;
  template: string;
  lastRow: boolean;
  originalMessage: string;
  onChange: (index: number, content: string, template: string) => void;
  onDelete: (index: number) => void;
}

export const TemplateRow = ({
  index,
  content,
  template,
  lastRow,
  originalMessage,
  onChange,
  onDelete,
}: TemplateRowProps) => {
  const { t } = useTranslation(Translation.Chat);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const templateRef = useRef<HTMLTextAreaElement>(null);
  const [validationContentError, setValidationContentError] = useState('');
  const [validationTemplateError, setValidationTemplateError] = useState('');

  const validate = useCallback(
    (element: HTMLTextAreaElement) => {
      if (lastRow) return;
      const setMethod =
        element === contentRef.current
          ? setValidationContentError
          : setValidationTemplateError;
      if (!element.value.trim()) {
        setMethod(t(ChatI18nKeys.FillInRequiredField));
        return;
      }
      const foundError = t(ChatI18nKeys.PartNotFoundInMessage);
      if (
        element === contentRef.current &&
        element.value &&
        originalMessage.indexOf(element.value.trim()) === -1
      ) {
        setMethod(foundError);
        return;
      } else if (validationContentError === foundError) {
        setMethod('');
      }
      if (
        element === templateRef.current &&
        element.value &&
        !PROMPT_VARIABLE_REGEX_TEST.test(element.value)
      ) {
        setMethod(t(ChatI18nKeys.TemplateMustHaveVariable));
        return;
      }
      const matchError = t(ChatI18nKeys.TemplateDoesntMatchMessage);
      if (
        contentRef.current?.value.trim() &&
        templateRef.current?.value.trim() &&
        !templateMatchContent(
          contentRef.current.value.trim(),
          templateRef.current.value.trim(),
        )
      ) {
        setValidationTemplateError(matchError);
        return;
      } else if (validationTemplateError === matchError) {
        setValidationTemplateError('');
        return;
      }
      setMethod('');
    },
    [
      lastRow,
      originalMessage,
      t,
      validationContentError,
      validationTemplateError,
    ],
  );

  useEffect(() => {
    if (contentRef.current) validate(contentRef?.current);
  }, [content, validate]);

  useEffect(() => {
    if (templateRef.current) validate(templateRef?.current);
  }, [template, validate]);

  useEffect(() => {
    setValidationContentError('');
    setValidationTemplateError('');
  }, [lastRow]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(
        index,
        contentRef.current?.value ?? '',
        templateRef.current?.value ?? '',
      );
      validate(event.target);
    },
    [index, onChange, validate],
  );

  const handleDelete = useCallback(() => onDelete(index), [index, onDelete]);

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLTextAreaElement>) => {
      event.target.value = event.target.value.trim();
      validate(event.target);
    },
    [validate],
  );

  return (
    <div
      className="flex items-start gap-2 p-3 md:px-6 md:py-4"
      data-qa="template-row"
    >
      <div className="flex grow flex-col gap-2">
        <TemplateInput
          value={content}
          dataQA="template-content"
          placeholder={t(ChatI18nKeys.APartOfTheMessage)}
          ref={contentRef}
          onInput={handleChange}
          onBlur={handleBlur}
          validationError={validationContentError}
        />
        <TemplateInput
          value={template}
          dataQA="template-value"
          placeholder={t(
            isSmallScreen()
              ? ChatI18nKeys.YourTemplateWithVariable
              : ChatI18nKeys.YourTemplateUseVariable,
          )}
          ref={templateRef}
          onInput={handleChange}
          onBlur={handleBlur}
          validationError={validationTemplateError}
        />
      </div>
      <IconTrashX
        size={DEFAULT_ICON_SIZES.STANDARD}
        className={classNames(
          'shrink-0 cursor-pointer self-center text-secondary hover:text-accent-primary',
          lastRow && 'invisible',
        )}
        onClick={handleDelete}
        name="delete-row"
      />
    </div>
  );
};

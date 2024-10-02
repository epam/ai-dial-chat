import { IconTrashX } from '@tabler/icons-react';
import {
  ChangeEvent,
  FocusEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { isSmallScreen } from '@/src/utils/app/mobile';
import { templateMatchContent } from '@/src/utils/app/prompts';

import { Translation } from '@/src/types/translation';

import { PROMPT_VARIABLE_REGEX } from '@/src/constants/folders';

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
        setMethod(t('Please fill in this required field') ?? '');
        return;
      }
      const foundError =
        t('This part was not found in the original message') ?? '';
      if (
        element === contentRef.current &&
        contentRef.current?.value &&
        originalMessage.indexOf(contentRef.current.value.trim()) === -1
      ) {
        setMethod(foundError);
        return;
      } else if (validationContentError === foundError) {
        setMethod('');
      }
      if (
        element === templateRef.current &&
        templateRef.current?.value &&
        !PROMPT_VARIABLE_REGEX.test(templateRef.current.value)
      ) {
        setMethod(t('Template must have at least one variable') ?? '');
        return;
      }
      const matchError = t("Template doesn't match the message text") ?? '';
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
    <div className="flex items-start gap-2 p-3 md:px-6">
      <div className="flex grow flex-col gap-2">
        <TemplateInput
          value={content}
          dataQA="template-content"
          placeholder={t('A part of the message') ?? ''}
          ref={contentRef}
          onInput={handleChange}
          onBlur={handleBlur}
          validationError={validationContentError}
        />
        <TemplateInput
          value={template}
          dataQA="template-value"
          placeholder={
            t(
              isSmallScreen()
                ? 'Your template with {{variable}}'
                : 'Your template. Use {{}} to denote a variable',
            ) ?? ''
          }
          ref={templateRef}
          onInput={handleChange}
          onBlur={handleBlur}
          validationError={validationTemplateError}
        />
      </div>
      <IconTrashX
        size={24}
        className={classNames(
          'shrink-0 cursor-pointer self-center text-secondary hover:text-accent-primary',
          lastRow && 'invisible',
        )}
        onClick={handleDelete}
      />
    </div>
  );
};

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
      if (!element.value) {
        setMethod(t('Please fill in this required field') ?? '');
        return;
      }
      if (
        element === contentRef.current &&
        contentRef.current?.value &&
        originalMessage.indexOf(contentRef.current.value) === -1
      ) {
        setValidationContentError(
          t('This part was not found in the original message') ?? '',
        );
        return;
      }
      if (
        templateRef.current?.value &&
        !PROMPT_VARIABLE_REGEX.test(templateRef.current.value)
      ) {
        setValidationTemplateError(
          t('Template must have at least one variable') ?? '',
        );
        return;
      }
      const matchError = t("Template doesn't match the message text") ?? '';
      if (
        contentRef.current?.value &&
        templateRef.current?.value &&
        !templateMatchContent(
          contentRef.current.value,
          templateRef.current.value,
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
    [lastRow, originalMessage, t, validationTemplateError],
  );
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
      validate(event.target);
    },
    [validate],
  );

  useEffect(() => {
    const handleResize = (ref: React.RefObject<HTMLTextAreaElement>) => () => {
      if (ref.current) {
        const height = ref.current.scrollHeight + 2;
        if (ref === contentRef) {
          if (templateRef.current) {
            templateRef.current.style.height = `${height}px`;
          }
        } else {
          if (contentRef.current) {
            contentRef.current.style.height = `${height}px`;
          }
        }
      }
    };

    const contentResizeObserver = new ResizeObserver(handleResize(contentRef));
    const templateResizeObserver = new ResizeObserver(
      handleResize(templateRef),
    );

    if (contentRef.current) {
      contentResizeObserver.observe(contentRef.current);
    }

    if (templateRef.current) {
      templateResizeObserver.observe(templateRef.current);
    }

    return () => {
      contentResizeObserver.disconnect();
      templateResizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="flex items-start gap-2 pb-3">
      <TemplateInput
        value={content}
        dataQA="template-content"
        placeholder={t('Part of message') ?? ''}
        ref={contentRef}
        onChange={handleChange}
        onBlur={handleBlur}
        validationError={validationContentError}
      />
      <TemplateInput
        value={template}
        dataQA="template-value"
        placeholder={t('Template') ?? ''}
        ref={templateRef}
        onChange={handleChange}
        onBlur={handleBlur}
        validationError={validationTemplateError}
      />
      <IconTrashX
        size={24}
        className={classNames(
          'shrink-0 cursor-pointer self-center text-secondary hover:text-accent-primary',
          lastRow && 'invisible',
          (validationContentError || validationTemplateError) && 'mb-5',
        )}
        onClick={handleDelete}
      />
    </div>
  );
};

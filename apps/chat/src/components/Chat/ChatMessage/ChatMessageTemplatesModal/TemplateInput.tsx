import { LegacyRef, forwardRef } from 'react';

import classNames from 'classnames';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

interface TemplateInputProps extends TextareaProps {
  validationError?: string;
  dataQA?: string;
}

export const TemplateInput = forwardRef(
  (
    { dataQA, validationError, className, ...rest }: TemplateInputProps,
    ref: LegacyRef<HTMLTextAreaElement> | undefined,
  ) => (
    <div className="flex grow basis-0 flex-col text-left">
      <textarea
        {...rest}
        ref={ref}
        className={classNames(
          className,
          'min-h-8 w-full grow resize-y whitespace-pre-wrap rounded border bg-transparent px-3 py-2 outline-none placeholder:text-secondary focus-visible:outline-none',
          !validationError
            ? 'border-primary focus-within:border-accent-primary'
            : 'border-error hover:border-error focus:border-error',
        )}
        rows={1}
        data-qa={dataQA ?? 'template-input'}
      />
      {validationError && (
        <span className="text-xxs text-error">{validationError}</span>
      )}
    </div>
  ),
);
TemplateInput.displayName = 'TemplateInput';

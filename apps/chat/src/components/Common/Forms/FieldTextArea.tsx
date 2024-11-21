import { TextareaHTMLAttributes, forwardRef } from 'react';

import classnames from 'classnames';

import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { withLabel } from '@/src/components/Common/Forms/Label';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean | string;
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ error, className, ...rest }, ref) => (
    <textarea
      {...rest}
      ref={ref}
      className={classnames(
        'input-form input-invalid peer mx-0',
        error && 'border-error hover:border-error focus:border-error',
        className,
      )}
    />
  ),
);

TextArea.displayName = 'TextArea';

export const FieldTextArea = withErrorMessage(withLabel(TextArea));

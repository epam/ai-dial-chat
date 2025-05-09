import { TextareaHTMLAttributes, forwardRef } from 'react';

import classnames from 'classnames';

import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { withLabel } from '@/src/components/Common/Forms/Label';
import Tooltip from '@/src/components/Common/Tooltip';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean | string;
  tooltip?: string;
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ error, className, disabled, tooltip, ...rest }, ref) => (
    <Tooltip tooltip={tooltip}>
      <textarea
        {...rest}
        ref={ref}
        disabled={disabled}
        className={classnames(
          'input-form input-invalid peer mx-0',
          error && 'border-error hover:border-error focus:border-error',
          disabled && 'cursor-not-allowed hover:border-primary',
          className,
        )}
      />
    </Tooltip>
  ),
);

TextArea.displayName = 'TextArea';

export const FieldTextArea = withErrorMessage(withLabel(TextArea));

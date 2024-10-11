import { InputHTMLAttributes, forwardRef } from 'react';

import classnames from 'classnames';

import { withErrorMessage } from '@/src/components/Common/Forms/FieldError';
import { withLabel } from '@/src/components/Common/Forms/Label';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean | string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className, ...rest }, ref) => (
    <input
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

Input.displayName = 'Input';

export const Field = withErrorMessage(withLabel(Input));

import { InputHTMLAttributes, forwardRef } from 'react';

import classNames from 'classnames';

import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { withLabel } from '@/src/components/Common/Forms/Label';

import Tooltip from '../Tooltip';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean | string;
  tooltip?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className, tooltip, ...rest }, ref) => {
    return (
      <Tooltip tooltip={tooltip}>
        <input
          {...rest}
          ref={ref}
          className={classNames(
            'input-form input-invalid peer mx-0 disabled:cursor-not-allowed disabled:border-primary',
            error && 'border-error hover:border-error focus:border-error',
            className,
          )}
        />
      </Tooltip>
    );
  },
);

Input.displayName = 'Input';

export const Field = withErrorMessage(withLabel(Input));

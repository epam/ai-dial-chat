import { InputHTMLAttributes, ReactNode, forwardRef } from 'react';

import classNames from 'classnames';

import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { Tooltip } from '@/src/components/Common/Tooltip';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean | string;
  tooltip?: ReactNode;
  dataQa?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className, tooltip, dataQa, ...rest }, ref) => {
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
          data-qa={dataQa}
        />
      </Tooltip>
    );
  },
);

Input.displayName = 'Input';

export const Field = withErrorMessage(withLabel(Input));

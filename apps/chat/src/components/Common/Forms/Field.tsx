import { InputHTMLAttributes, forwardRef } from 'react';

import classNames from 'classnames';

import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { withLabel } from '@/src/components/Common/Forms/Label';

import { TooltipWrapper } from './TooltipWrapper';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean | string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className, ...rest }, ref) => (
    <input
      {...rest}
      ref={ref}
      className={classNames(
        'input-form input-invalid peer mx-0 disabled:cursor-not-allowed disabled:border-primary',
        error && 'border-error hover:border-error focus:border-error',
        className,
      )}
    />
  ),
);

Input.displayName = 'Input';

export const Field = withErrorMessage(withLabel(TooltipWrapper(Input)));

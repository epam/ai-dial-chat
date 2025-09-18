import { IconEye, IconEyeOff } from '@tabler/icons-react';
import {
  InputHTMLAttributes,
  ReactNode,
  forwardRef,
  useCallback,
  useState,
} from 'react';

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
  ({ error, className, tooltip, dataQa, type, ...rest }, ref) => {
    const [isVisible, setIsVisible] = useState(false);

    const inputType =
      type === 'password' ? (isVisible ? 'text' : 'password') : type;

    const handleTogglePassword = useCallback(() => {
      setIsVisible((prev) => !prev);
    }, []);

    return (
      <Tooltip tooltip={tooltip}>
        <div className="relative">
          <input
            {...rest}
            ref={ref}
            className={classNames(
              'input-form input-invalid peer mx-0 disabled:cursor-not-allowed disabled:border-primary',
              error && 'border-error hover:border-error focus:border-error',
              type === 'password' && 'pr-9',
              className,
            )}
            data-qa={dataQa}
            type={inputType}
          />

          {type === 'password' && (
            <button
              className="button absolute right-0 top-1/2 -translate-y-1/2"
              onClick={handleTogglePassword}
            >
              {isVisible ? (
                <IconEye size={18} className="text-secondary" />
              ) : (
                <IconEyeOff size={18} className="text-secondary" />
              )}
            </button>
          )}
        </div>
      </Tooltip>
    );
  },
);

Input.displayName = 'Input';

export const Field = withErrorMessage(withLabel(Input));

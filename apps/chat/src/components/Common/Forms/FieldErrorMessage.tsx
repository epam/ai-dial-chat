import { ComponentType, forwardRef } from 'react';

import classNames from 'classnames';

import { translateFormError } from '@/src/utils/app/translateFormError';

interface Props {
  error?: string;
  className?: string;
}

export const FieldErrorMessage = ({ error, className }: Props) => {
  if (!error) {
    return null;
  }

  return (
    <div
      className={classNames('text-xxs text-error', className)}
      data-qa="error-message"
    >
      {translateFormError(error)}
    </div>
  );
};

export function withErrorMessage<T extends object, R>(
  Component: ComponentType<T>,
) {
  const ErrorMessageWrapper = forwardRef<R, Omit<Props, 'className'> & T>(
    (props, ref) => {
      const { error, ...restProps } = props;
      return (
        <div>
          <Component
            {...(restProps as Omit<Props, 'className' | 'ref'> & T)}
            ref={ref}
          />

          <FieldErrorMessage error={error} className="mt-1" />
        </div>
      );
    },
  );

  ErrorMessageWrapper.displayName = 'ErrorMessageWrapper';

  return ErrorMessageWrapper;
}

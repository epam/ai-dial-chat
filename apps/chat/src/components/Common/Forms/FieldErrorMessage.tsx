import { ComponentType, forwardRef } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

interface Props {
  error?: string;
  className?: string;
}

export const FieldErrorMessage = ({ error, className }: Props) => {
  const { t } = useTranslation(Translation.Settings);

  if (!error) {
    return null;
  }

  return (
    <div className={classNames('text-xxs text-error', className)}>
      {t(error)}
    </div>
  );
};

export function withErrorMessage<T extends object, R>(
  Component: ComponentType<T>,
) {
  const ErrorMessageWrapper = forwardRef<R, Omit<Props, 'className'> & T>(
    (props, ref) => (
      <div>
        <Component {...props} ref={ref} />

        <FieldErrorMessage error={props.error} className="mt-1" />
      </div>
    ),
  );

  ErrorMessageWrapper.displayName = 'ErrorMessageWrapper';

  return ErrorMessageWrapper;
}

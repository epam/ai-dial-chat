import { ComponentType, forwardRef } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

interface Props {
  warning?: string;
  className?: string;
}

export const FieldWarningMessage = ({ warning, className }: Props) => {
  const { t } = useTranslation(Translation.Settings);

  if (!warning) {
    return null;
  }

  return (
    <div className={classNames('text-xxs text-warning', className)}>
      {t(warning)}
    </div>
  );
};

export function withWarningMessage<T extends object, R>(
  Component: ComponentType<T>,
) {
  const WarningMessageWrapper = forwardRef<R, Omit<Props, 'className'> & T>(
    (props, ref) => (
      <div>
        <Component {...props} ref={ref} />

        <FieldWarningMessage warning={props.warning} className="mt-1" />
      </div>
    ),
  );

  WarningMessageWrapper.displayName = 'WarningMessageWrapper';

  return WarningMessageWrapper;
}

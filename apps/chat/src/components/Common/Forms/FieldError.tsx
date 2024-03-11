import { FieldError } from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

interface Props {
  error?: FieldError;
  className?: string;
}

export const FieldErrorMessage = ({ error, className }: Props) => {
  const { t } = useTranslation(Translation.Settings);

  if (!error?.message) {
    return null;
  }

  return (
    <div className={classNames('mb-4 text-xxs text-error', className)}>
      {t(error.message)}
    </div>
  );
};

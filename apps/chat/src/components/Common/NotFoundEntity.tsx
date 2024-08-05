import { IconAlertTriangle } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

interface Props {
  entity: string;
  containerClassName?: string;
  dataQa?: string;
  additionalText?: string;
}

export const NotFoundEntity = ({
  entity,
  containerClassName,
  dataQa = 'not-found',
  additionalText,
}: Props) => {
  const { t } = useTranslation(Translation.Common);

  return (
    <div
      className={classNames(
        'flex flex-col items-center justify-center text-primary-bg-light',
        containerClassName || 'h-full',
      )}
      data-qa={dataQa}
    >
      <IconAlertTriangle stroke={1} size={60} />
      <p className="mt-3 text-center text-sm">
        {t('common.text.entity_not_found', { entity })}
      </p>
      {additionalText && (
        <p className="mt-1 text-center text-sm">{additionalText}</p>
      )}
    </div>
  );
};

import { IconAlertTriangle } from '@tabler/icons-react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

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
        'flex flex-col items-center justify-center',
        containerClassName || 'h-full',
      )}
      data-qa={dataQa}
    >
      <IconAlertTriangle stroke={1} className="text-secondary" size={60} />
      <p className="mt-3 text-center text-sm">{t(`${entity} not found.`)}</p>
      {additionalText && (
        <p className="mt-1 text-center text-sm">{t(additionalText)}</p>
      )}
    </div>
  );
};

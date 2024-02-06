import { IconReload } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

interface Props {
  entity: string;
  containerClassName?: string;
  dataQa?: string;
}

export const NotFoundEntity = ({
  entity,
  containerClassName,
  dataQa = 'not-found',
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
      <IconReload stroke={1} className="text-secondary" size={60} />
      <p className="mt-3 text-center text-sm">{t(`${entity} not found.`)}</p>
      <p className="mt-1 text-center text-sm">{t('Please reload the page.')}</p>
    </div>
  );
};

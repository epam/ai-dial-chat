import { IconReload } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';
import classNames from 'classnames';

interface Props {
  className?: string;
  entity: string;
}

export const NotFoundEntity = ({ entity }: Props) => {
  const { t } = useTranslation(Translation.Common);

  return (
    <div className={classNames("flex h-full flex-col items-center justify-center", className)}>
      <IconReload stroke={1} className="text-secondary" size={60} />
      <p className="mt-3 text-center text-sm">{t(`${entity} not found.`)}</p>
      <p className="mt-1 text-center text-sm">{t('Please reload the page.')}</p>
    </div>
  );
};

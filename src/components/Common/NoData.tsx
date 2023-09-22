import { useTranslation } from 'next-i18next';

import ClipboardXMark from '../../../public/images/icons/clipboard-xmark.svg';

export const NoData = () => {
  const { t } = useTranslation('common');
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <ClipboardXMark height={60} width={60} className="text-gray-500" />
      <span>{t('No data')}</span>
    </div>
  );
};

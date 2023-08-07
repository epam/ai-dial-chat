import { useTranslation } from 'react-i18next';

import Magnifier from '../../public/images/icons/search-alt.svg';

export const NoResultsFound = () => {
  const { t } = useTranslation('common');
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <Magnifier height={45} width={45} className="text-gray-500" />
      <span>{t('No results found')}</span>
    </div>
  );
};

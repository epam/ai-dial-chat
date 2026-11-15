import { Spinner } from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { BasicI18nKeys } from '../../constants/translation-keys';

const RouteFallback: FC = () => {
  const { t } = useTranslation();

  return (
    <div className="flex size-full items-center justify-center">
      <Spinner ariaLabel={t(BasicI18nKeys.Loading)} />
    </div>
  );
};

export default memo(RouteFallback);

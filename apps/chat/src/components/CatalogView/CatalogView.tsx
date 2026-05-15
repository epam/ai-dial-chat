import { memo } from 'react';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { CatalogI18nKeys } from '../../constants/translation-keys';

const CatalogView: FC = () => {
  const { t } = useTranslation();

  return (
    <section
      aria-label={t(CatalogI18nKeys.AriaLabel)}
      className="flex h-full items-center justify-center"
    >
      <p className="text-secondary">{t(CatalogI18nKeys.ComingSoon)}</p>
    </section>
  );
};

export default memo(CatalogView);

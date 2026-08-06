import { IconRefresh } from '@tabler/icons-react';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppUpdateI18nKeys,
  ErrorBoundaryI18nKeys,
} from '../../constants/translation-keys';
import AlertShell from '../AlertShell/AlertShell';

const handleReload = () => {
  window.location.reload();
};

/** Full-screen prompt shown instead of the app once a newer build has been deployed. */
const NewVersionFallback: FC = () => {
  const { t } = useTranslation();

  return (
    <AlertShell
      icon={
        <IconRefresh
          aria-hidden="true"
          size={48}
          stroke={1.5}
          className="text-accent"
        />
      }
      heading={t(AppUpdateI18nKeys.Heading)}
      message={t(AppUpdateI18nKeys.Message)}
      actionLabel={t(ErrorBoundaryI18nKeys.ReloadLabel)}
      onAction={handleReload}
    />
  );
};

export default memo(NewVersionFallback);

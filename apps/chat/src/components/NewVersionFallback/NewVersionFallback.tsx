import { PrimaryButton } from '@epam/ai-dial-ui-kit';
import { IconRefresh } from '@tabler/icons-react';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppUpdateI18nKeys,
  ErrorBoundaryI18nKeys,
} from '../../constants/translation-keys';

const handleReload = () => {
  window.location.reload();
};

/** Full-screen prompt shown instead of the app once a newer build has been deployed. */
const NewVersionFallback: FC = () => {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      className="flex size-full flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <IconRefresh
        aria-hidden="true"
        size={48}
        stroke={1.5}
        className="text-accent-primary"
      />
      <h2>{t(AppUpdateI18nKeys.Heading)}</h2>
      <p className="text-secondary">{t(AppUpdateI18nKeys.Message)}</p>
      <PrimaryButton
        autoFocus
        label={t(ErrorBoundaryI18nKeys.ReloadLabel)}
        onClick={handleReload}
      />
    </div>
  );
};

export default memo(NewVersionFallback);

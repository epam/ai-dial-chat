import { NewVersionAlert } from '@epam/ai-dial-chat-shared';
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
    <NewVersionAlert
      onReload={handleReload}
      labels={{
        heading: t(AppUpdateI18nKeys.Heading),
        message: t(AppUpdateI18nKeys.Message),
        reloadLabel: t(ErrorBoundaryI18nKeys.ReloadLabel),
      }}
    />
  );
};

export default memo(NewVersionFallback);

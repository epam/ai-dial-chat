import type { ProjectDetailsDto } from '@epam/ai-dial-chat-api-client';
import { useProjectRevokeAccess as useSharedProjectRevokeAccess } from '@epam/ai-dial-chat-hooks/project';
import { useTranslation } from 'react-i18next';
import { CatalogI18nKeys } from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { projectSharingClient } from './useProjectShareRecipients';

/** Binds reusable revoke state to translated notifications and the app's client. */
export const useProjectRevokeAccess = (
  project: ProjectDetailsDto | null,
  onRevoked: () => void,
) => {
  const { t } = useTranslation();
  const { showSuccessNotification, showErrorNotification } = useNotification();
  return useSharedProjectRevokeAccess(projectSharingClient, project, {
    onRevoked: (revoked) => {
      showSuccessNotification({
        title: t(CatalogI18nKeys.DetailsRevokeShareSuccessTitle),
        message: t(CatalogI18nKeys.DetailsRevokeShareSuccess, {
          name: revoked.name,
        }),
      });
      onRevoked();
    },
    onError: (failed, requestId) =>
      showErrorNotification({
        title: t(CatalogI18nKeys.DetailsRevokeShareErrorTitle),
        message: t(CatalogI18nKeys.DetailsRevokeShareError, {
          name: failed.name,
        }),
        requestId,
      }),
  });
};

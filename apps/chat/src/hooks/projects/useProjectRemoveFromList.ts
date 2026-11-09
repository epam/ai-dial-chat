import type { ProjectDetailsDto } from '@epam/ai-dial-chat-api-client';
import { useProjectRemoveFromList as useSharedProjectRemoveFromList } from '@epam/ai-dial-chat-hooks/project';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { CatalogI18nKeys } from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { useUserConfig } from '../../context/UserConfigContext';
import { discardSharedCatalogItem } from '../../server-api/share.api';
import { ROUTES } from '../../types/routes';

/** How the removal behaves around its outcome. */
interface UseProjectRemoveFromListOptions {
  /** Leaves for the Projects list after a removal; `false` keeps the current route. Defaults to `true`. */
  leaveOnRemove?: boolean;
  /** Called once the request settles, whether it succeeded or failed, so the caller can close its dialog. */
  onSettled?: () => void;
}

/**
 * App adapter of the shared `useProjectRemoveFromList`: discards through the
 * share API, unpins through the user config, toasts the outcome and, unless
 * told otherwise, leaves for the Projects list.
 *
 * @param project - The project to remove, or `null` while none is chosen.
 * @param options - Navigation and settle behaviour.
 */
export const useProjectRemoveFromList = (
  project: ProjectDetailsDto | null,
  { leaveOnRemove = true, onSettled }: UseProjectRemoveFromListOptions = {},
) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showSuccessNotification, showErrorNotification } = useNotification();
  const { setPinnedProject, replacePinnedProjectId } = useUserConfig();

  return useSharedProjectRemoveFromList(project, {
    discardShared: discardSharedCatalogItem,
    setPinned: setPinnedProject,
    onUnpinFailed: (removed) => replacePinnedProjectId(removed.id, null),
    onRemoved: (removed) => {
      showSuccessNotification({
        title: t(CatalogI18nKeys.DetailsUnshareSuccessTitle),
        message: t(CatalogI18nKeys.DetailsUnshareSuccess, {
          name: removed.name,
        }),
      });
      /* Replace the entry, so Back does not reopen the removed project. */
      if (leaveOnRemove) navigate(ROUTES.Projects, { replace: true });
    },
    onError: (failed, requestId) =>
      showErrorNotification({
        title: t(CatalogI18nKeys.DetailsUnshareErrorTitle),
        message: t(CatalogI18nKeys.DetailsUnshareError, { name: failed.name }),
        requestId,
      }),
    onSettled,
  });
};

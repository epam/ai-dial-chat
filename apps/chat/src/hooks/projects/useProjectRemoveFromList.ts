import type { ProjectDetailsDto } from '@epam/ai-dial-chat-api-client';
import { getApiErrorDetails } from '@epam/ai-dial-chat-hooks';
import { useCallback, useRef, useState } from 'react';
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
 * Drops a project shared with the user from their own list: discards only
 * the caller's access, unpins the project, toasts the outcome and, unless
 * told otherwise, leaves for the Projects list. The owner's project and the
 * other recipients' access are untouched.
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
  const [isRemoving, setIsRemoving] = useState(false);
  /* A second confirm lands before the first render shows `isRemoving`. */
  const isInFlightRef = useRef(false);

  const confirmRemove = useCallback(async () => {
    if (project == null || isInFlightRef.current) return;
    isInFlightRef.current = true;
    setIsRemoving(true);
    try {
      await discardSharedCatalogItem(project.id);
    } catch (err) {
      const { traceId } = await getApiErrorDetails(err);
      showErrorNotification({
        title: t(CatalogI18nKeys.DetailsUnshareErrorTitle),
        message: t(CatalogI18nKeys.DetailsUnshareError, {
          name: project.name,
        }),
        requestId: traceId,
      });
      isInFlightRef.current = false;
      setIsRemoving(false);
      onSettled?.();
      return;
    }
    /* The pin is only housekeeping: a failed write is mirrored locally so the entry still leaves the sidebar. */
    try {
      await setPinnedProject(project.id, false);
    } catch {
      replacePinnedProjectId(project.id, null);
    }
    showSuccessNotification({
      title: t(CatalogI18nKeys.DetailsUnshareSuccessTitle),
      message: t(CatalogI18nKeys.DetailsUnshareSuccess, { name: project.name }),
    });
    isInFlightRef.current = false;
    setIsRemoving(false);
    onSettled?.();
    /* Replace the entry, so Back does not reopen the removed project. */
    if (leaveOnRemove) navigate(ROUTES.Projects, { replace: true });
  }, [
    project,
    leaveOnRemove,
    navigate,
    onSettled,
    replacePinnedProjectId,
    setPinnedProject,
    showErrorNotification,
    showSuccessNotification,
    t,
  ]);

  return { isRemoving, confirmRemove };
};

import {
  useAcceptShareInvitation,
  type AcceptShareInvitationErrorLabels,
} from '@epam/ai-dial-chat-hooks';
import { FC, memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import { ShareI18nKeys } from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { usePrompts } from '../../context/PromptsContext';
import { useSkills } from '../../context/SkillsContext';
import { acceptInvitation } from '../../server-api/share.api';
import { CatalogQuery } from '../../types/catalog';
import { ROUTES } from '../../types/routes';

interface Props {
  /** Builds the route to navigate to once the invitation is accepted, from the shared resource's itemId. */
  getTargetRoute?: (itemId: string) => string;
  /** Route to fall back to when accepting the invitation fails. */
  errorFallbackRoute?: string;
  /** Refreshes the catalog lists after accepting, so the catalog can open the shared item. Defaults to `true`. */
  shouldRefreshCatalog?: boolean;
}

const getDefaultTargetRoute = (itemId: string): string => {
  const params = new URLSearchParams({ [CatalogQuery.ItemId]: itemId });
  return `${ROUTES.Catalog}?${params.toString()}`;
};

/**
 * Landing route for an opened share link. Silently accepts the invitation
 * via the backend (`useAcceptShareInvitation`), then redirects to the shared
 * item — the catalog by default, or wherever `getTargetRoute` points for
 * other resource kinds (e.g. conversations). Shows nothing but a loading
 * spinner — there is no confirm step.
 */
const SharedInvitationPage: FC<Props> = ({
  getTargetRoute = getDefaultTargetRoute,
  errorFallbackRoute = ROUTES.Catalog,
  shouldRefreshCatalog = true,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showErrorNotification } = useNotification();
  const { refetchDeployments, refetchToolsets, mergeSharedItem } =
    useDeployments();
  const { refetchSkills, mergeSharedSkill } = useSkills();
  /*
   * A shared prompt has no list-item summary to merge (the backend cannot
   * summarise one), so the refetch below is the only way the just-granted
   * prompt reaches the catalog list — and the details panel only opens for
   * an item that list already contains.
   */
  const { refetchPrompts } = usePrompts();
  const { invitationId } = useParams<{ invitationId: string }>();

  /*
   * The catalog's details panel only opens for `itemId` if it can find a
   * matching entry in the already-loaded deployments/toolsets/skills/prompts
   * list (see `Catalog`'s `initialDetailsItemId` effect).
   */
  const refreshCatalog = useCallback(
    () =>
      Promise.all([
        refetchDeployments(),
        refetchToolsets(),
        refetchSkills(),
        refetchPrompts(),
      ]),
    [refetchDeployments, refetchToolsets, refetchSkills, refetchPrompts],
  );

  const labels = useMemo<AcceptShareInvitationErrorLabels>(
    () => ({
      notFound: t(ShareI18nKeys.InvitationNotFound),
      usersLimitReached: (name) =>
        t(ShareI18nKeys.InvitationUsersLimitReached, { name }),
      usersLimitReachedUnnamed: t(
        ShareI18nKeys.InvitationUsersLimitReachedUnnamed,
      ),
      acceptError: t(ShareI18nKeys.InvitationAcceptError),
    }),
    [t],
  );

  useAcceptShareInvitation({
    invitationId,
    acceptInvitation,
    refreshLists: shouldRefreshCatalog ? refreshCatalog : undefined,
    onSharedItem: mergeSharedItem,
    onSharedSkill: mergeSharedSkill,
    onAccepted: ({ itemId }) =>
      navigate(getTargetRoute(itemId), { replace: true }),
    onError: ({ message, requestId }) => {
      showErrorNotification({ message, requestId });
      navigate(errorFallbackRoute, { replace: true });
    },
    labels,
  });

  return <RouteFallback />;
};

export default memo(SharedInvitationPage);

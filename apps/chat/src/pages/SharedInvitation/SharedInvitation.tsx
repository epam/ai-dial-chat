import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { FC, memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import { ShareI18nKeys } from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { getApiErrorMessage } from '../../server-api/api-error';
import { acceptInvitation } from '../../server-api/share.api';
import { CatalogQuery } from '../../types/catalog';
import { ROUTES } from '../../types/routes';

interface Props {
  /** Builds the route to navigate to once the invitation is accepted, from the shared resource's itemId. */
  getTargetRoute?: (itemId: string) => string;
  /** Route to fall back to when accepting the invitation fails. */
  errorFallbackRoute?: string;
}

const getDefaultTargetRoute = (itemId: string): string => {
  const params = new URLSearchParams({ [CatalogQuery.ItemId]: itemId });
  return `${ROUTES.Catalog}?${params.toString()}`;
};

/**
 * Landing route for an opened share link. Silently accepts the invitation
 * via the backend, then redirects to the shared item — the catalog by
 * default, or wherever `getTargetRoute` points for other resource kinds
 * (e.g. conversations). Shows nothing but a loading spinner — there is no
 * confirm step.
 */
const SharedInvitationPage: FC<Props> = ({
  getTargetRoute = getDefaultTargetRoute,
  errorFallbackRoute = ROUTES.Catalog,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const { invitationId } = useParams<{ invitationId: string }>();
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!invitationId || hasStartedRef.current) return;
    hasStartedRef.current = true;

    const accept = async () => {
      try {
        const { itemId } = await acceptInvitation(invitationId);
        navigate(getTargetRoute(itemId), { replace: true });
      } catch (err) {
        const errorMessage = await getApiErrorMessage(err);
        showNotification({
          variant: NotificationVariant.Error,
          message: errorMessage ?? t(ShareI18nKeys.InvitationAcceptError),
        });
        navigate(errorFallbackRoute, { replace: true });
      }
    };

    void accept();
  }, [
    invitationId,
    navigate,
    showNotification,
    t,
    getTargetRoute,
    errorFallbackRoute,
  ]);

  return <RouteFallback />;
};

export default memo(SharedInvitationPage);

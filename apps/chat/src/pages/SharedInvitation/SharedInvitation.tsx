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

/**
 * Landing route for an opened share link. Silently accepts the invitation
 * via the backend, then redirects into the catalog with the shared item
 * selected. Shows nothing but a loading spinner — there is no confirm step.
 */
const SharedInvitationPage: FC = () => {
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
        const params = new URLSearchParams({ [CatalogQuery.ItemId]: itemId });
        navigate(`${ROUTES.Catalog}?${params.toString()}`, { replace: true });
      } catch (err) {
        const errorMessage = await getApiErrorMessage(err);
        showNotification({
          variant: NotificationVariant.Error,
          message: errorMessage ?? t(ShareI18nKeys.InvitationAcceptError),
        });
        navigate(ROUTES.Catalog, { replace: true });
      }
    };

    void accept();
  }, [invitationId, navigate, showNotification, t]);

  return <RouteFallback />;
};

export default memo(SharedInvitationPage);

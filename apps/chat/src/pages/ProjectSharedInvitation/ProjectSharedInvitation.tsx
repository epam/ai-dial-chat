import { FC, memo } from 'react';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import { getProjectViewRoute } from '../../constants/routes';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { ROUTES } from '../../types/routes';
import { UserConfigStatus } from '../../types/user-config-status';
import NotFoundPage from '../NotFound/NotFound';
import SharedInvitationPage from '../SharedInvitation/SharedInvitation';

/**
 * Landing route for a project share link. Reuses `SharedInvitationPage` for
 * the accept and error handling — including DIAL Core's accepted-users limit —
 * but opens the project view once accepted without refreshing the catalog
 * lists, and is gated by the projects
 * flag so a disabled deployment never accepts a project invitation.
 */
const ProjectSharedInvitationPage: FC = () => {
  const { status } = useAppConfig();
  const isEnabled = useFeatureFlag('projectsEnabled');

  if (status !== UserConfigStatus.Ready) return <RouteFallback />;
  if (!isEnabled) return <NotFoundPage />;

  return (
    <SharedInvitationPage
      getTargetRoute={getProjectViewRoute}
      errorFallbackRoute={ROUTES.Projects}
      /* The project view loads the project itself; the catalog lists are
       * irrelevant to it. */
      shouldRefreshCatalog={false}
    />
  );
};

export default memo(ProjectSharedInvitationPage);

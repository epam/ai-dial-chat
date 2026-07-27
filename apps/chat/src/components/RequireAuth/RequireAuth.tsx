import { DialSpinner } from '@epam/ai-dial-ui-kit';
import { memo, type FC, type ReactNode } from 'react';
import { useUser } from '../../context/auth/UserContext';
import { useOptionalOverlay } from '../../context/overlay/OverlayContext';
import { useAuthRedirect } from '../../hooks/auth/useAuthRedirect';
import { AuthStatus } from '../../types/auth-status';
import OverlayLoginGate from '../OverlayLoginGate/OverlayLoginGate';

interface Props {
  children: ReactNode;
}

const RequireAuth: FC<Props> = ({ children }) => {
  const { status } = useUser();
  /*
   * Presence (not a boolean field) is the overlay-mode signal: OverlayProvider
   * only mounts when overlay mode is eligible (see OverlayModeGate).
   */
  const overlay = useOptionalOverlay();
  useAuthRedirect({ disabled: Boolean(overlay) });

  if (status === AuthStatus.Loading) {
    if (overlay) {
      /*
       * In overlay mode, the library's own loader (visible in the host page,
       * layered over the iframe) is the only loading indicator — an
       * app-rendered spinner here would be a redundant, flashing duplicate.
       */
      return null;
    }
    return (
      <div className="flex size-full items-center justify-center">
        <DialSpinner />
      </div>
    );
  }

  if (status === AuthStatus.Unauthenticated && overlay) {
    return <OverlayLoginGate />;
  }

  if (status !== AuthStatus.Authenticated) {
    return null;
  }

  return children;
};

export default memo(RequireAuth);

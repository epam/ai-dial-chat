import { DialSpinner } from '@epam/ai-dial-ui-kit';
import { memo, type FC, type ReactNode } from 'react';
import { useUser } from '../../context/auth/UserContext';
import { useAuthRedirect } from '../../hooks/auth/useAuthRedirect';
import { AuthStatus } from '../../types/auth-status';

interface Props {
  children: ReactNode;
}

const RequireAuth: FC<Props> = ({ children }) => {
  const { status } = useUser();
  useAuthRedirect();

  if (status === AuthStatus.Loading) {
    return (
      <div className="flex size-full items-center justify-center">
        <DialSpinner />
      </div>
    );
  }

  if (status !== AuthStatus.Authenticated) {
    return null;
  }

  return children;
};

export default memo(RequireAuth);

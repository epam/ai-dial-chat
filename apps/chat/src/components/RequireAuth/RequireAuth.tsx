import { DialSpinner } from '@epam/ai-dial-ui-kit';
import { memo, type FC, type ReactNode } from 'react';
import { AuthStatus, useUser } from '../../context/auth/UserContext';
import { useAuthRedirect } from '../../hooks/auth/useAuthRedirect';

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

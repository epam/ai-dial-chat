import { DialLoader } from '@epam/ai-dial-ui-kit';
import { ReactNode } from 'react';
import { useUser } from '../../context/UserContext';
import { useAuthRedirect } from '../../hooks/useAuthRedirect';

interface RequireAuthProps {
  children: ReactNode;
}

const RequireAuth = ({ children }: RequireAuthProps) => {
  const { status } = useUser();
  useAuthRedirect();

  if (status === 'loading') {
    return <DialLoader />;
  }

  if (status !== 'authenticated') {
    return null;
  }

  return children;
};

export default RequireAuth;

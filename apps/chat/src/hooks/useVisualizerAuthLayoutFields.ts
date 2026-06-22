import { useSession } from 'next-auth/react';
import { useMemo } from 'react';

import { CustomVisualizerDataLayout } from '@epam/ai-dial-shared';

interface UseVisualizerAuthLayoutFieldsOptions {
  passAuthInfo?: boolean;
  passExplicitToken?: boolean;
}

export const useVisualizerAuthLayoutFields = ({
  passAuthInfo,
  passExplicitToken,
}: UseVisualizerAuthLayoutFieldsOptions): Partial<CustomVisualizerDataLayout> => {
  const { data: session } = useSession();

  return useMemo((): Partial<CustomVisualizerDataLayout> => {
    const sessionAccessToken = session?.accessToken;
    const tokenField =
      passExplicitToken && sessionAccessToken != null
        ? { accessToken: sessionAccessToken }
        : {};

    if (!passAuthInfo || !session) return tokenField;

    const email = session.user?.email ?? undefined;
    const providerId = (session as { providerId?: string }).providerId;
    return {
      ...(email != null && { logInHint: email }),
      ...(providerId != null && { providerId }),
      ...tokenField,
    };
  }, [passAuthInfo, passExplicitToken, session]);
};

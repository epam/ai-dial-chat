import { Session } from 'next-auth';

import { Feature } from '@epam/ai-dial-shared';

export const isUserAdmin = (session: Session | null | undefined) => {
  return !!session?.user.isAdmin;
};

export const canUserUseFeature = (
  session: Session | null | undefined,
  feature: Feature,
) => {
  return session?.user?.[feature] ?? true;
};

import { SessionContextValue } from 'next-auth/react';

import { TokenSet } from 'next-auth';
import { JWT } from 'next-auth/jwt';

export interface AuthState {
  session: SessionContextValue<boolean> | undefined;
}

export interface Token extends JWT {
  providerId?: string;
  userId: string;
  refreshToken: string | TokenSet;
}

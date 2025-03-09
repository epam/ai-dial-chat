import { SessionContextValue } from 'next-auth/react';

export interface AuthState {
  session: SessionContextValue<boolean> | undefined;
}

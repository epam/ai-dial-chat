import { TokenSet } from 'next-auth';
import { JWT } from 'next-auth/jwt';

export interface Token extends JWT {
  providerId?: string;
  userId: string;
  refreshToken: string | TokenSet;
}

export type SameSite = true | false | 'lax' | 'strict' | 'none' | undefined;

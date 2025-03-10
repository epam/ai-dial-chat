import { DefaultSession } from 'next-auth';
import { DefaultJWT } from 'next-auth/jwt';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare module '*.svg' {
  const content: any;
  export const ReactComponent: any;
  export default content;
}

type UserData = {
  isAdmin: boolean;
} & Record<Feature, boolean>;

declare module 'next-auth' {
  interface Session {
    user: UserData & DefaultSession['user'];
    providerId: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    user?: Partial<UserData>;
    access_token?: string;
  }
}

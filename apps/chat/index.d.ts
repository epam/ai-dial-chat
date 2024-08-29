import { DefaultSession } from 'next-auth';
import { DefaultJWT } from 'next-auth/jwt';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare module '*.svg' {
  const content: any;
  export const ReactComponent: any;
  export default content;
}

declare module 'next-auth' {
  interface Session {
    user: {
      isAdmin: boolean;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    user?: Partial<{
      dial_roles: string[];
    }>;
    access_token?: string;
  }
}

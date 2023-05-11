import type { AuthOptions } from 'next-auth';
import NextAuth from 'next-auth/next';
import AzureProvider from 'next-auth/providers/azure-ad';

interface IGraphUser {
  '@odata.context': string;
  businessPhones: string[];
  displayName: string;
  givenName: string;
  jobTitle: string;
  mail: string;
  mobilePhone: string;
  officeLocation: string;
  preferredLanguage: string;
  surname: string;
  userPrincipalName: string;
  id: string;
}

export const authOptions: AuthOptions = {
  providers: [
    AzureProvider({
      clientId: process.env.AUTH_CLIENT_ID as string,
      clientSecret: process.env.AUTH_CLIENT_SECRET as string,
      tenantId: process.env.AUTH_TENANT_ID as string,
      name: 'EPAM SSO',
      authorization: { params: { scope: 'openid profile user.Read email' } },
    }),
  ],
  callbacks: {
    jwt: async (options) => {
      if (options.account) {
        options.token.jobTitle = options.account.jobTitle;
      }
      return options.token;
    },
    signIn: async (options) => {
      if (!options.account?.access_token) {
        return false;
      }
      let jobTitle = 'unknown';
      try {
        const user = (await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: {
            Authorization: `${options.account.token_type} ${options.account.access_token}`,
            Accept: 'application/json',
          },
        }).then((r) => r.json())) as IGraphUser;
        jobTitle = user.jobTitle ?? 'unknown';
      } catch {}

      options.account.jobTitle = jobTitle;
      return true;
    },
    session: async (options) => {
      (options as any).session.jobTitle = options.token.jobTitle;

      return options.session;
    },
  },
  session: {
    strategy: 'jwt',
  },
};
export default NextAuth(authOptions);

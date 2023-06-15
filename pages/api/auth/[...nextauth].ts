import type { AuthOptions } from 'next-auth';
import NextAuth from 'next-auth/next';
import { OAuthConfig, OAuthUserConfig, Provider } from 'next-auth/providers';
import Auth0Provider from 'next-auth/providers/auth0';
import AzureProvider from 'next-auth/providers/azure-ad';
import CredentialsProvider from 'next-auth/providers/credentials';
import { GitLabProfile } from 'next-auth/providers/gitlab';
import GoogleProvider from 'next-auth/providers/google';

const DEFAULT_NAME = 'SSO';

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

function GitLab<P extends GitLabProfile>(
  options: OAuthUserConfig<P> & { gitlabHost?: string },
): OAuthConfig<P> {
  const host = options.gitlabHost ?? 'https://gitlab.com';

  return {
    id: 'gitlab',
    name: 'GitLab',
    type: 'oauth',
    authorization: {
      url: `${host}/oauth/authorize`,
      params: { scope: 'read_user' },
    },
    token: `${host}/oauth/token`,
    userinfo: `${host}/api/v4/user`,
    checks: ['pkce', 'state'],
    profile(profile) {
      return {
        id: profile.id.toString(),
        name: profile.name ?? profile.username,
        email: profile.email,
        image: profile.avatar_url,
      };
    },
    style: {
      logo: '/gitlab.svg',
      logoDark: '/gitlab-dark.svg',
      bg: '#fff',
      text: '#FC6D26',
      bgDark: '#FC6D26',
      textDark: '#fff',
    },
    options,
  };
}

const allProviders: (Provider | boolean)[] = [
  !!process.env.AUTH_AZURE_AD_CLIENT_ID &&
    !!process.env.AUTH_AZURE_AD_SECRET &&
    !!process.env.AUTH_AZURE_AD_TENANT_ID &&
    AzureProvider({
      clientId: process.env.AUTH_AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AUTH_AZURE_AD_SECRET,
      tenantId: process.env.AUTH_AZURE_AD_TENANT_ID,
      name: process.env.AUTH_AZURE_AD_NAME ?? DEFAULT_NAME,
      authorization: { params: { scope: 'openid profile user.Read email' } },
    }),

  !!process.env.AUTH_GITLAB_CLIENT_ID &&
    !!process.env.AUTH_GITLAB_SECRET &&
    GitLab({
      clientId: process.env.AUTH_GITLAB_CLIENT_ID,
      clientSecret: process.env.AUTH_GITLAB_SECRET,
      name: process.env.AUTH_GITLAB_NAME ?? DEFAULT_NAME,
      gitlabHost: process.env.AUTH_GITLAB_HOST,
    }),

  !!process.env.AUTH_GOOGLE_CLIENT_ID &&
    !!process.env.AUTH_GOOGLE_SECRET &&
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      name: process.env.AUTH_GOOGLE_NAME ?? DEFAULT_NAME,
    }),

  !!process.env.AUTH_AUTH0_CLIENT_ID &&
    !!process.env.AUTH_AUTH0_SECRET &&
    !!process.env.AUTH_AUTH0_HOST &&
    Auth0Provider({
      clientId: process.env.AUTH_AUTH0_CLIENT_ID,
      clientSecret: process.env.AUTH_AUTH0_SECRET,
      name: process.env.AUTH_AUTH0_NAME ?? DEFAULT_NAME,
      issuer: process.env.AUTH_AUTH0_HOST,
    }),

  !!process.env.AUTH_TEST_TOKEN &&
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        access_token: {
          label: 'Token',
          type: 'password',
        },
      },
      async authorize(credentials, req) {
        if (credentials?.access_token === process.env.AUTH_TEST_TOKEN) {
          return {
            id: '0',
            email: 'test',
            name: 'test',
          };
        }
        return null;
      },
    }),
];

const providers = allProviders.filter(Boolean) as Provider[];

if (!providers.length) {
  console.error('No auth providers!');
}

export const authOptions: AuthOptions = {
  providers,
  callbacks: {
    jwt: async (options) => {
      if (options.account) {
        options.token.jobTitle = options.account.jobTitle;
      }
      return options.token;
    },
    signIn: async (options) => {
      if (
        options.account?.type === 'credentials' &&
        options.credentials?.access_token === process.env.AUTH_TEST_TOKEN
      ) {
        return true;
      }

      if (!options.account?.access_token) {
        return false;
      }
      if (process.env.USE_USER_JOB_TITLE === 'true') {
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
      }
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

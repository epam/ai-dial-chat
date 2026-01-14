import type { AuthOptions, CookieOption, CookiesOptions } from 'next-auth';
import NextAuth from 'next-auth/next';

import { constructPath } from '@/src/utils/app/file';
import { getThemeIconUrl } from '@/src/utils/app/themes';
import { callbacks } from '@/src/utils/auth/auth-callbacks';
import { pages } from '@/src/utils/auth/auth-pages';
import { authProviders } from '@/src/utils/auth/auth-providers';

// https://github.com/nextauthjs/next-auth/blob/a8dfc8ebb11ccb96fd694db888e52f0d20395e64/packages/core/src/lib/cookie.ts#L53
function defaultCookies(
  useSecureCookies: boolean,
  sameSite = 'lax',
): CookiesOptions {
  const cookiePrefix = useSecureCookies ? '__Secure-' : '';
  type Options = CookieOption['options'];
  const options: Options = {
    httpOnly: true,
    sameSite,
    path: '/',
    secure: useSecureCookies,
  };
  const optionsWithLongExpiry: Options = {
    ...options,
    maxAge: 60 * 15, // 15 minutes in seconds
  };
  return {
    // default cookie options
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options,
    },
    callbackUrl: {
      name: `${cookiePrefix}next-auth.callback-url`,
      options,
    },
    csrfToken: {
      // Default to __Host- for CSRF token for additional protection if using useSecureCookies
      // NB: The `__Host-` prefix is stricter than the `__Secure-` prefix.
      name: `${useSecureCookies ? '__Host-' : ''}next-auth.csrf-token`,
      options,
    },
    pkceCodeVerifier: {
      name: `${cookiePrefix}next-auth.pkce.code_verifier`,
      options: optionsWithLongExpiry,
    },
    state: {
      name: `${cookiePrefix}next-auth.state`,
      options: optionsWithLongExpiry,
    },
    nonce: {
      name: `${cookiePrefix}next-auth.nonce`,
      options,
    },
  };
}

const isSecure =
  !!process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.startsWith('https:');

const isIframe = process.env.IS_IFRAME === 'true';

const isDebugEnabled =
  process.env.AUTH_DEBUG_ENABLED === 'true' ||
  process.env.AUTH_DEBUG_ENABLED === '1';

export const authOptions: AuthOptions = {
  providers: authProviders,
  cookies: defaultCookies(isSecure, isSecure && isIframe ? 'none' : 'lax'),
  callbacks,
  debug: isDebugEnabled,
  session: {
    strategy: 'jwt',
  },
  theme: {
    logo: process.env.THEMES_CONFIG_HOST
      ? constructPath(
          process.env.APP_BASE_PATH || '',
          getThemeIconUrl('favicon'),
        )
      : undefined,
  },
  pages,
};

export default NextAuth(authOptions);

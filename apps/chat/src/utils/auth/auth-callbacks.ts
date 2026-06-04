import { Account, CallbacksOptions, Profile, Session } from 'next-auth';

import { parseCommaSeparatedList } from '@/src/utils/app/common';
import { logger } from '@/src/utils/server/logger';

import { Token } from '@/src/types/auth';

import { safeParseJSON } from '../json';
import {
  CREDENTIALS_PROVIDER_ID,
  getProviderConfigById,
  isCredentialsProvider,
} from './auth-providers';
import {
  getTokenExpirationMs,
  validateProviderAccessToken,
} from './auth-token-utils';
import NextClient, { RefreshToken } from './nextauth-client';

import { Feature } from '@epam/ai-dial-shared';
import { JWTPayload, decodeJwt } from 'jose';
import get from 'lodash-es/get';
import intersection from 'lodash-es/intersection';
import snakeCase from 'lodash-es/snakeCase';
import { TokenSet } from 'openid-client';

const waitRefreshTokenTimeout = 5;
const CREDENTIALS_ACCOUNT_TYPE = 'credentials';

const safeDecodeJwt = (jwtToken: string) => {
  try {
    return decodeJwt(jwtToken);
  } catch (err) {
    console.error("Token couldn't be parsed as JWT", err);
    // TODO: read roles from GCP token format
    return {};
  }
};

const providersWithNotJWTToken = ['gitlab', 'google'];

const getJWTPayload = (
  accessToken: string | undefined,
  idToken: string | undefined,
  providerId: string,
): JWTPayload => {
  const useIdTokenForProviders = parseCommaSeparatedList(
    process.env.AUTH_IDTOKEN_PROVIDERS,
  );
  const useIdToken = useIdTokenForProviders.includes(providerId);
  const token = useIdToken ? idToken : accessToken;
  const skipDecoding =
    !useIdToken && providersWithNotJWTToken.includes(providerId);
  return token && !skipDecoding ? safeDecodeJwt(token) : {};
};

const getUser = (
  accessToken: string | undefined,
  idToken: string | undefined,
  providerId: string,
) => {
  const rolesFieldName =
    process.env[
      `AUTH_${snakeCase(providerId).toUpperCase()}_DIAL_ROLES_FIELD`
    ] ??
    process.env.DIAL_ROLES_FIELD ??
    'dial_roles';
  const adminRoleNames = parseCommaSeparatedList(
    process.env[
      `AUTH_${snakeCase(providerId).toUpperCase()}_ADMIN_ROLE_NAMES`
    ] ?? process.env.ADMIN_ROLE_NAMES,
    ['admin'],
  );

  const decodedPayload = getJWTPayload(accessToken, idToken, providerId);
  const dialRoles = get(decodedPayload, rolesFieldName, []) as string[];
  const roles = Array.isArray(dialRoles) ? dialRoles : [dialRoles];
  const isAdmin =
    roles.length > 0 && adminRoleNames.some((role) => roles.includes(role));

  const enabledFeaturesRoles = safeParseJSON(
    process.env.ENABLED_FEATURES_ROLES?.replaceAll('\\"', '"'),
    'Error when parsing ENABLED_FEATURES_ROLES',
    logger,
  );

  const featureFlags = Array.from(Object.values(Feature)).reduce(
    (flags, feature) => {
      const featureRoles = enabledFeaturesRoles[feature];
      if (featureRoles) {
        const featureRolesArr = Array.isArray(featureRoles)
          ? featureRoles
          : parseCommaSeparatedList(featureRoles);
        if (
          featureRolesArr.length &&
          !intersection(featureRolesArr, roles).length
        ) {
          flags[feature] = false;
        }
      }
      return flags;
    },
    {} as Record<Feature, boolean>,
  );

  return {
    isAdmin,
    ...featureFlags,
  };
};

/**
 * Takes a token, and returns a new token with updated
 * `accessToken` and `accessTokenExpires`. If an error occurs,
 * returns the old token and an error property
 */
async function refreshAccessToken(token: Token) {
  const displayedTokenSub =
    process.env.SHOW_TOKEN_SUB === 'true' ? token.sub : '******';
  // Track whether this invocation acquired the refresh lock so we can release
  // it on failure (waiters that time out must NOT clear the lock).
  let didAcquireLock = false;
  try {
    if (!token.providerId) {
      throw new Error(`No provider information exists in token`);
    }
    const client = await NextClient.getOrDiscoverClient(token.providerId);
    if (!client) {
      throw new Error(`No client for appropriate provider set`);
    }

    let msWaiting = 0;
    while (true) {
      const refresh = NextClient.getRefreshToken(token.userId);

      if (!refresh || !refresh.isRefreshing) {
        const localToken: RefreshToken = refresh || {
          isRefreshing: false,
          token,
        };
        if (
          typeof localToken.token?.accessTokenExpires === 'number' &&
          Date.now() < localToken.token.accessTokenExpires
        ) {
          logger.debug(
            `[Auth] Returning cached refreshed token. Sub: ${displayedTokenSub}`,
          );
          return localToken.token;
        }

        NextClient.setIsRefreshTokenStart(token.userId, {
          token: localToken.token,
          isRefreshing: true,
        });
        didAcquireLock = true;
        logger.debug(
          `[Auth] Starting token refresh. Sub: ${displayedTokenSub}`,
        );
        break;
      }

      logger.debug(
        `[Auth] Waiting for concurrent refresh. Sub: ${displayedTokenSub}`,
      );
      await NextClient.delay();
      msWaiting += 50;

      if (msWaiting >= waitRefreshTokenTimeout * 1000) {
        throw new Error(
          `Waiting more than ${waitRefreshTokenTimeout} seconds for refreshing token`,
        );
      }
    }

    const refreshedTokens = await client.refresh(
      token.refreshToken as string | TokenSet,
    );

    if (
      !refreshedTokens ||
      (!refreshedTokens.expires_in && !refreshedTokens.expires_at)
    ) {
      throw new Error(`Error from auth provider while refreshing token`);
    }

    if (!refreshedTokens.refresh_token) {
      logger.warn(
        `Auth provider didn't provide new refresh token. Sub: ${displayedTokenSub}`,
      );
    }

    if (!refreshedTokens.refresh_token && !token.refreshToken) {
      throw new Error('No refresh tokens exists');
    }
    const idToken = refreshedTokens.id_token ?? token.idToken;
    const access_token = refreshedTokens.access_token;
    const decodedPayload = getJWTPayload(
      access_token,
      idToken,
      token.providerId,
    );
    const returnToken = {
      ...token,
      user: getUser(
        refreshedTokens.access_token,
        refreshedTokens.id_token,
        token.providerId,
      ),
      access_token,
      accessTokenExpires: decodedPayload.exp
        ? decodedPayload.exp * 1000
        : refreshedTokens.expires_in
          ? Date.now() + refreshedTokens.expires_in * 1000
          : (refreshedTokens.expires_at as number) * 1000,
      idToken,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
    };

    logger.debug(`[Auth] Token refresh succeeded. Sub: ${displayedTokenSub}`);
    NextClient.setIsRefreshTokenStart(token.userId, {
      isRefreshing: false,
      token: returnToken,
    });
    return returnToken;
  } catch (error: unknown) {
    // Only the request that acquired the lock should release it.
    // Waiters that timed out must not clear the lock belonging to the refresher.
    if (didAcquireLock) {
      NextClient.resetRefreshingState(token.userId);
    }
    logger.error(
      error,
      `Error when refreshing token: ${
        (error as Error).message
      }. Sub: ${displayedTokenSub}`,
    );

    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

type JwtCallbackOptions = Parameters<
  NonNullable<
    CallbacksOptions<Profile & { job_title?: string }, Account>['jwt']
  >
>[0];

const handleCredentialsAccountJwt = async (options: JwtCallbackOptions) => {
  const credUser = options.user as
    | { accessToken?: string; provider?: string }
    | undefined;
  const credentialsAccessToken =
    typeof credUser?.accessToken === 'string'
      ? credUser.accessToken
      : undefined;
  const signInProvider =
    typeof credUser?.provider === 'string' && credUser.provider
      ? credUser.provider
      : undefined;

  const providerConfig = getProviderConfigById(signInProvider);

  if (!credentialsAccessToken) {
    logger.warn('[Credentials] Missing access token in jwt callback');
    return {
      ...options.token,
      providerId: CREDENTIALS_PROVIDER_ID,
      error: 'CredentialsAccessTokenValidationError',
    };
  }

  if (!signInProvider || !providerConfig) {
    logger.warn(
      `[Credentials] Missing or unsupported signInProvider in jwt callback: ${signInProvider ?? 'undefined'}`,
    );
    return {
      ...options.token,
      providerId: CREDENTIALS_PROVIDER_ID,
      error: 'CredentialsAccessTokenValidationError',
    };
  }
  const tokenValidationResult = await validateProviderAccessToken({
    token: credentialsAccessToken,
    provider: providerConfig,
  });

  if (!tokenValidationResult.ok) {
    logger.warn(
      `[Credentials] Token validation failed (provider=${signInProvider}): ${tokenValidationResult.error.message}`,
    );
    return {
      ...options.token,
      providerId: CREDENTIALS_PROVIDER_ID,
      error: 'CredentialsAccessTokenValidationError',
    };
  }
  const accessTokenExpires = getTokenExpirationMs(
    tokenValidationResult.payload,
  );

  if (typeof accessTokenExpires !== 'number') {
    logger.warn(
      `[Credentials] Token validation succeeded but exp claim is missing/non-numeric (provider=${signInProvider})`,
    );
    return {
      ...options.token,
      providerId: CREDENTIALS_PROVIDER_ID,
      error: 'CredentialsAccessTokenValidationError',
    };
  }

  const validatedPayload = tokenValidationResult.payload as Record<
    string,
    unknown
  >;
  const validatedSub =
    typeof validatedPayload.sub === 'string' ? validatedPayload.sub : undefined;
  const validatedName =
    typeof validatedPayload.name === 'string'
      ? validatedPayload.name
      : typeof validatedPayload.preferred_username === 'string'
        ? validatedPayload.preferred_username
        : undefined;
  const validatedEmail =
    typeof validatedPayload.email === 'string'
      ? validatedPayload.email
      : typeof validatedPayload.upn === 'string'
        ? validatedPayload.upn
        : typeof validatedPayload.preferred_username === 'string'
          ? validatedPayload.preferred_username
          : undefined;

  return {
    ...options.token,
    sub: validatedSub ?? options.token.sub,
    name: validatedName,
    email: validatedEmail,
    user: getUser(credentialsAccessToken, undefined, CREDENTIALS_PROVIDER_ID),
    access_token: credentialsAccessToken,
    accessTokenExpires,
    refreshToken: undefined,
    providerId: CREDENTIALS_PROVIDER_ID,
    userId: validatedSub ?? options.user?.id ?? options.token.sub ?? '',
    idToken: undefined,
  };
};

export const callbacks: Partial<
  CallbacksOptions<Profile & { job_title?: string }, Account>
> = {
  jwt: async (options) => {
    if (options.account) {
      if (options.account.type === CREDENTIALS_ACCOUNT_TYPE) {
        return handleCredentialsAccountJwt(options);
      }

      const idToken = options.account.id_token;
      const access_token = options.account.access_token;
      const providerId = options.account.provider;
      const decodedPayload = getJWTPayload(access_token, idToken, providerId);
      return {
        ...options.token,
        user: getUser(
          options.account.access_token,
          options.account.id_token,
          options.account.provider,
        ),
        jobTitle: options.profile?.job_title,
        access_token,
        accessTokenExpires: decodedPayload.exp
          ? decodedPayload.exp * 1000
          : typeof options.account.expires_in === 'number'
            ? Date.now() + options.account.expires_in * 1000
            : (options.account.expires_at as number) * 1000,
        refreshToken: options.account.refresh_token,
        providerId,
        userId: options.user.id,
        idToken,
      };
    }

    const providerId =
      typeof options.token.providerId === 'string'
        ? options.token.providerId
        : undefined;

    // Credentials tokens cannot be refreshed server-side; once expired, we must re-run sign-in.
    if (isCredentialsProvider(providerId)) {
      const expiresAt =
        typeof options.token.accessTokenExpires === 'number'
          ? options.token.accessTokenExpires
          : undefined;

      if (typeof expiresAt === 'number' && Date.now() >= expiresAt) {
        return {
          ...options.token,
          error: 'CredentialsAccessTokenExpired',
        };
      }

      return {
        ...options.token,
        user: getUser(
          options.token.access_token,
          options.token.idToken,
          CREDENTIALS_PROVIDER_ID,
        ),
      };
    }

    // Return previous token if the access token has not expired yet
    if (
      typeof options.token.accessTokenExpires === 'number' &&
      Date.now() < options.token.accessTokenExpires
    ) {
      return {
        ...options.token,
        user: getUser(
          options.token.access_token,
          options.token.idToken,
          typeof options.token.providerId === 'string'
            ? options.token.providerId
            : '',
        ),
      };
    }
    const typedToken = options.token as Token;
    // Access token has expired, try to update it
    return refreshAccessToken(typedToken);
  },
  signIn: async (options) => {
    if (options.account?.type === CREDENTIALS_ACCOUNT_TYPE) {
      const credentialsAccessToken =
        typeof (options.user as { accessToken?: unknown } | undefined)
          ?.accessToken === 'string'
          ? (options.user as { accessToken?: string }).accessToken
          : undefined;

      return Boolean(credentialsAccessToken);
    }

    if (!options.account?.access_token) {
      return false;
    }

    return true;
  },
  session: async (options) => {
    if (options.token?.error) {
      (options.session as Session & { error?: unknown }).error =
        options.token.error;
    }

    const isAdmin = options?.token?.user?.isAdmin ?? false;

    if (options.session.user) {
      options.session.user.isAdmin = isAdmin;
      Object.values(Feature).forEach((feature) => {
        if (options?.token?.user?.[feature] === false) {
          options.session.user[feature] = false;
        }
      });
    }

    const providerId =
      typeof options.token.providerId === 'string'
        ? options.token.providerId
        : '';
    options.session.providerId = providerId;

    if (process.env.ALLOW_TOKEN_IN_SESSION) {
      const accessToken = options.token?.access_token;
      if (accessToken) {
        options.session.accessToken = accessToken;
      }
    }
    return options.session;
  },
};

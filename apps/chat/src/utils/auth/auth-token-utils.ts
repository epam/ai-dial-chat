import { OAuthConfig } from 'next-auth/providers';

import {
  type JWTPayload,
  type ProtectedHeaderParameters,
  createRemoteJWKSet,
  decodeProtectedHeader,
  jwtVerify,
} from 'jose';

export type TokenValidationOk = {
  ok: true;
  provider: string;
  protectedHeader: ProtectedHeaderParameters;
  payload: JWTPayload;
};

export type TokenValidationErr = {
  ok: false;
  provider: string;
  error: {
    message: string;
  };
};

export type TokenValidationResult = TokenValidationOk | TokenValidationErr;

export const getTokenExpirationMs = (
  payload: JWTPayload,
): number | undefined => {
  return typeof payload.exp === 'number' ? payload.exp * 1000 : undefined;
};

type OidcDiscovery = {
  jwks_uri: string;
};

const getJwks = async (params: { provider: string; wellKnown: string }) => {
  const wellKnownResponse = await fetch(params.wellKnown);
  const oidcConfig = (await wellKnownResponse.json()) as Partial<OidcDiscovery>;
  const jwksUri = oidcConfig.jwks_uri;

  if (typeof jwksUri !== 'string' || !jwksUri) {
    throw new Error('OIDC well-known response missing jwks_uri');
  }

  return createRemoteJWKSet(new URL(jwksUri));
};

const validateJwtWithOidc = async (params: {
  token: string;
  provider: string;
  issuer: string;
  audience?: string;
  wellKnown: string;
}): Promise<TokenValidationResult> => {
  try {
    const jwks = await getJwks({
      provider: params.provider,
      wellKnown: params.wellKnown,
    });

    const protectedHeader = decodeProtectedHeader(params.token);

    const { payload } = await jwtVerify(params.token, jwks, {
      issuer: params.issuer,
      audience: params.audience,
    });

    return {
      ok: true,
      provider: params.provider,
      protectedHeader,
      payload,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      provider: params.provider,
      error: {
        message: message,
      },
    };
  }
};

export const validateProviderAccessToken = async (params: {
  token: string;
  provider: OAuthConfig<Record<string, unknown>> | undefined;
}): Promise<TokenValidationResult> => {
  const provider = params.provider;

  if (!provider?.options?.issuer) {
    return {
      ok: false,
      provider: provider?.id ?? 'unknown',
      error: {
        message: 'Missing issuer',
      },
    };
  }
  if (!provider?.wellKnown) {
    return {
      ok: false,
      provider: provider?.id ?? 'unknown',
      error: {
        message: 'Missing well-known endpoint',
      },
    };
  }
  const authorization = provider?.authorization;
  const audience =
    typeof authorization === 'string'
      ? undefined
      : authorization?.params?.audience;
  return validateJwtWithOidc({
    provider: provider?.id ?? 'unknown',
    token: params.token,
    issuer: provider?.options?.issuer,
    audience: audience,
    wellKnown: provider?.wellKnown,
  });
};

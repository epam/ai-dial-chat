import * as jose from 'jose';
import fetch from 'node-fetch';

interface OpenIdConfig {
    jwks_uri: string;
}

const globalObj = globalThis as unknown as any;

async function getJwksUrl(baseUrl: string) : Promise<string> {
  const url = `${baseUrl}/.well-known/openid-configuration`;
  const errMsg = `Request for openid-configuration returned an error`;
  const response = await fetch(url).catch((error) => {
    throw new Error(`${errMsg}: ${error.message}`);
  });

  if (response.status !== 200) {
    throw new Error(`${errMsg} ${response.status}: ${await response.text()}`);
  }

  const config = (await response.json()) as OpenIdConfig;
  return config.jwks_uri;
}

function log(msg: any) {
  /* eslint-disable no-console */
  console.log('%s %s', new Date(), msg);
  /* eslint-enable no-console */
}

function printToken(token: string) {
  try {
    const protectedHeader = JSON.stringify(jose.decodeProtectedHeader(token));
    log(`protectedHeader -> ${protectedHeader}`);
  } catch (error) {
    log(`error occurred at decoding protectedHeader: ${error}`);
  }
  try {
    const claims = jose.decodeJwt(token);
    const exp = claims.exp;
    const iat = claims.iat;
    const iss = claims.iss;
    log(`claims ->  exp: ${exp}, iat: ${iat}, iss: ${iss}`);
  } catch (error) {
    log(`error occurred at decoding claims: ${error}`);
  }
}

export async function validateToken(token: string) {
  if (globalObj.jwks === undefined) {
    if (process.env.AUTH_KEYCLOAK_HOST) {
      const jwksUrl = await getJwksUrl(process.env.AUTH_KEYCLOAK_HOST);
      globalObj.jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
    } else {
      globalObj.jwks = null;
    }
  }
  if (globalObj.jwks) {
    jose.jwtVerify(token, globalObj.jwks).catch((error) => {
      log(`error occurred at verifying token: ${error}`);
      printToken(token);
    });
  } else {
    log('Env var AUTH_KEYCLOAK_HOST is not set');
    printToken(token);
  }
}

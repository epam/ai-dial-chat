import * as jose from 'jose';
import fetch from 'node-fetch';

async function getJwksUrl(baseUrl) {
  const url = `${baseUrl}/.well-known/openid-configuration`;
  const errMsg = `Request for openid-configuration returned an error`;
  const response = await fetch(url).catch((error) => {
    throw new Error(`${errMsg}: ${error.message}`);
  });

  if (response.status !== 200) {
    throw new Error(`${errMsg} ${response.status}: ${await response.text()}`);
  }

  const json = await response.json();
  return json["jwks_uri"];
}

function log(msg) {
  console.log("%s %s", new Date(), msg);
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
  if (global.jwks === undefined) {
    if (process.env.AUTH_KEYCLOAK_HOST) {
      const jwksUrl = await getJwksUrl(process.env.AUTH_KEYCLOAK_HOST);
      global.jwks = jose.createRemoteJWKSet(new URL(jwksUrl))
    } else {
      global.jwks = null;
    }
  }
  if (jwks) {
    jose.jwtVerify(token, jwks).catch((error) => {
     log(`error occurred at verifying token: ${error}`);
     printToken(token);
    });
  } else {
    log("Env var AUTH_KEYCLOAK_HOST is not set");
    printToken(token);
  }
}
import type { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import type { EnvironmentVariables } from '../../config/environment.config';

const HOST_PREFIX = '__Host-';
const COOKIE_CHUNK_SIZE = 3800;

interface CookiePart {
  name: string;
  value: string;
}

const isSecureCookieEnabled = (
  config: ConfigService<EnvironmentVariables, true>,
): boolean => {
  const secure = config.get('AUTH_COOKIE_SECURE', { infer: true });
  return secure !== false;
};

const isOverlayEmbeddingEnabled = (
  config: ConfigService<EnvironmentVariables, true>,
): boolean => {
  const overlayEnabled = config.get('OVERLAY_ENABLED', { infer: true });
  const allowedOrigins =
    config.get('ALLOWED_IFRAME_ORIGINS', { infer: true }) ?? [];
  return overlayEnabled === true && allowedOrigins.length > 0;
};

export const getCookieSameSite = (
  config: ConfigService<EnvironmentVariables, true>,
): CookieOptions['sameSite'] => {
  return isSecureCookieEnabled(config) && isOverlayEmbeddingEnabled(config)
    ? 'none'
    : 'lax';
};

const COOKIE_NAME_DEFAULTS: Record<
  'AUTH_SESSION_COOKIE_NAME' | 'AUTH_TRANSACTION_COOKIE_NAME',
  string
> = {
  AUTH_SESSION_COOKIE_NAME: '__Host-chat.sess',
  AUTH_TRANSACTION_COOKIE_NAME: '__Host-chat.tx',
};

const getCookieName = (
  config: ConfigService<EnvironmentVariables, true>,
  key: 'AUTH_SESSION_COOKIE_NAME' | 'AUTH_TRANSACTION_COOKIE_NAME',
): string => {
  const configuredName =
    config.get(key, { infer: true }) ?? COOKIE_NAME_DEFAULTS[key];
  if (isSecureCookieEnabled(config)) {
    return configuredName;
  }

  return configuredName.startsWith(HOST_PREFIX)
    ? configuredName.slice(HOST_PREFIX.length)
    : configuredName;
};

export const getCookieOptions = (
  config: ConfigService<EnvironmentVariables, true>,
): CookieOptions => ({
  httpOnly: true,
  secure: isSecureCookieEnabled(config),
  sameSite: getCookieSameSite(config),
  path: '/',
});

export const getSessionCookieName = (
  config: ConfigService<EnvironmentVariables, true>,
): string => getCookieName(config, 'AUTH_SESSION_COOKIE_NAME');

export const getTransactionCookieName = (
  config: ConfigService<EnvironmentVariables, true>,
): string => getCookieName(config, 'AUTH_TRANSACTION_COOKIE_NAME');

const getChunkIndex = (
  cookieName: string,
  candidate: string,
): number | null => {
  if (!candidate.startsWith(`${cookieName}.`)) {
    return null;
  }

  const index = candidate.slice(cookieName.length + 1);
  if (!/^\d+$/.test(index)) {
    return null;
  }

  return Number(index);
};

export const splitCookieValue = (
  cookieName: string,
  value: string,
): CookiePart[] => {
  if (Buffer.byteLength(value) <= COOKIE_CHUNK_SIZE) {
    return [{ name: cookieName, value }];
  }

  const chunks: CookiePart[] = [];
  for (
    let offset = 0, index = 0;
    offset < value.length;
    offset += COOKIE_CHUNK_SIZE, index += 1
  ) {
    chunks.push({
      name: `${cookieName}.${index}`,
      value: value.slice(offset, offset + COOKIE_CHUNK_SIZE),
    });
  }

  return chunks;
};

export const readCookieValue = (
  cookies: Record<string, string> | undefined,
  cookieName: string,
): string | undefined => {
  if (!cookies) {
    return undefined;
  }

  const chunks = Object.entries(cookies)
    .map(([name, value]) => ({ index: getChunkIndex(cookieName, name), value }))
    .filter((chunk): chunk is { index: number; value: string } => {
      return chunk.index !== null;
    })
    .sort((a, b) => a.index - b.index);

  if (chunks.length > 0) {
    return chunks.map((chunk) => chunk.value).join('');
  }

  return cookies[cookieName];
};

export const getCookieNamesToClear = (
  cookies: Record<string, string> | undefined,
  cookieName: string,
): string[] => {
  const names = new Set<string>([cookieName]);

  for (const name of Object.keys(cookies ?? {})) {
    if (getChunkIndex(cookieName, name) !== null) {
      names.add(name);
    }
  }

  return [...names].sort((a, b) => {
    const aIndex = getChunkIndex(cookieName, a) ?? -1;
    const bIndex = getChunkIndex(cookieName, b) ?? -1;
    return aIndex - bIndex;
  });
};

export const setCookieValue = (
  res: Response,
  cookieName: string,
  value: string,
  options: CookieOptions,
  existingCookies?: Record<string, string>,
): void => {
  const parts = splitCookieValue(cookieName, value);
  const partNames = new Set(parts.map((part) => part.name));

  for (const name of getCookieNamesToClear(existingCookies, cookieName)) {
    if (!partNames.has(name)) {
      res.cookie(name, '', { ...options, maxAge: 0 });
    }
  }

  for (const part of parts) {
    res.cookie(part.name, part.value, options);
  }
};

export const clearCookieValue = (
  res: Response,
  cookieName: string,
  options: CookieOptions,
  existingCookies?: Record<string, string>,
): void => {
  for (const name of getCookieNamesToClear(existingCookies, cookieName)) {
    res.cookie(name, '', { ...options, maxAge: 0 });
  }
};

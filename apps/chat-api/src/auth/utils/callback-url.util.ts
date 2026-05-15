import { BadRequestException } from '@nestjs/common';

interface ResolveCallbackUrlOptions {
  authCallbackBaseUrl: string;
  corsOrigin?: string;
}

const parseOrigin = (value?: string): string | undefined => {
  if (!value || value === '*') {
    return undefined;
  }

  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
};

const getAllowedOrigins = ({
  authCallbackBaseUrl,
  corsOrigin,
}: ResolveCallbackUrlOptions): string[] => {
  const origins = new Set<string>();

  for (const candidate of (corsOrigin ?? '').split(',')) {
    const origin = parseOrigin(candidate.trim());
    if (origin) {
      origins.add(origin);
    }
  }

  const callbackOrigin = parseOrigin(authCallbackBaseUrl);
  if (callbackOrigin) {
    origins.add(callbackOrigin);
  }

  return Array.from(origins);
};

export const resolveCallbackUrl = (
  rawCallbackUrl: string | undefined,
  options: ResolveCallbackUrlOptions,
): string => {
  const allowedOrigins = getAllowedOrigins(options);
  const applicationOrigin =
    allowedOrigins[0] ?? parseOrigin(options.authCallbackBaseUrl);

  if (!applicationOrigin) {
    throw new BadRequestException('Invalid callback URL configuration');
  }

  const trimmed = rawCallbackUrl?.trim();
  if (!trimmed) {
    return new URL('/', applicationOrigin).toString();
  }

  if (trimmed.startsWith('//')) {
    throw new BadRequestException('Invalid callbackUrl');
  }

  let callbackUrl: URL;
  try {
    callbackUrl = trimmed.startsWith('/')
      ? new URL(trimmed, applicationOrigin)
      : new URL(trimmed);
  } catch {
    throw new BadRequestException('Invalid callbackUrl');
  }

  if (!['http:', 'https:'].includes(callbackUrl.protocol)) {
    throw new BadRequestException('Invalid callbackUrl');
  }

  if (callbackUrl.username || callbackUrl.password) {
    throw new BadRequestException('Invalid callbackUrl');
  }

  if (!allowedOrigins.includes(callbackUrl.origin)) {
    throw new BadRequestException('Invalid callbackUrl');
  }

  return callbackUrl.toString();
};

import { BadRequestException } from '@nestjs/common';

export const LANG_HEADER = 'X-Lang';
export const LANG_MAX_LENGTH = 35;
export const LANG_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;

/**
 * Validates optional request-scoped UI language context before it can reach
 * an upstream header. The original value is preserved for DIAL Core
 * forwarding, matching the timezone-header contract.
 */
export const assertValidOptionalLang = (
  lang: string | string[] | undefined,
): string | undefined => {
  if (lang === undefined) return undefined;

  if (
    typeof lang !== 'string' ||
    lang.length > LANG_MAX_LENGTH ||
    !LANG_PATTERN.test(lang)
  ) {
    throw new BadRequestException(`${LANG_HEADER} header is invalid`);
  }

  return lang;
};

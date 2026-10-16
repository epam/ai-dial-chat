import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/*
 * Mirrors DIAL Core's own path rules rather than the files-API rules: Core
 * rejects only control characters, `/`, `{`, `}` and `"` in a decoded path
 * element, and a query or fragment in the raw path. Its URL encoder leaves
 * `: ; , = & @ + $ ! ' ( ) *` literal, so canonical ids (e.g. a Bedrock model
 * id ending `-v1:0` inside a conversation filename) legitimately contain them.
 * `\` is kept rejected even though Core would accept it in a name.
 */
const FORBIDDEN_NAME_CHARS = /[\\{}"]/;
const MALFORMED_PERCENT_ENCODING = /%(?![0-9A-Fa-f]{2})/;
const MAX_CONTROL_CHAR_CODE = 0x1f;

const ASCII_PERCENT_ESCAPE = /%[0-7][0-9A-Fa-f]/g;

/*
 * `decodeURIComponent` throws on any invalid UTF-8 byte (e.g. `%FF`), and
 * falling back to the raw segment would hide an encoded `{`, newline or `/`
 * next to it. On failure only the ASCII escapes are decoded, in a single
 * pass, so they are still checked; bytes `%80`-`%FF` stay as written.
 */
const decodeSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment.replace(ASCII_PERCENT_ESCAPE, (escape) =>
      String.fromCharCode(parseInt(escape.slice(1), 16)),
    );
  }
};

const hasControlChar = (value: string): boolean => {
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) <= MAX_CONTROL_CHAR_CODE) return true;
  }
  return false;
};

const hasForbiddenChar = (value: string): boolean =>
  FORBIDDEN_NAME_CHARS.test(value) || hasControlChar(value);

const isTraversalOrEmptySegment = (segment: string): boolean =>
  segment === '' || segment === '.' || segment === '..';

/**
 * Returns `true` when `value` is a well-formed DIAL Core resource id
 * (`{type}/{bucket}/{path}`): no leading `/`, no empty, `.` or `..` segment
 * (literal or percent-encoded), no `\`, `{`, `}`, `"`, `?`, `#` or control
 * character, and no malformed percent-encoding. Each segment is decoded once
 * and re-split on `/` so `..%2Fx` and `%2e%2e` cannot hide a traversal
 * segment, while a legitimate `%2F` inside a name stays valid.
 *
 * Use this for full resource ids exactly as DIAL Core emits them (conversation
 * and prompt ids, `itemId` of the share endpoints). For deployment or toolset
 * names validated against a strict character allowlist, use
 * {@link isSafeResourceId} instead.
 * @param value - candidate `itemId`
 */
export const isDialResourceId = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (value.startsWith('/') || value.includes('?') || value.includes('#')) {
    return false;
  }
  if (MALFORMED_PERCENT_ENCODING.test(value) || hasForbiddenChar(value)) {
    return false;
  }

  return value.split('/').every((rawSegment) => {
    if (rawSegment === '') return false;

    const decoded = decodeSegment(rawSegment);
    if (hasForbiddenChar(decoded)) return false;

    return !decoded.split('/').some(isTraversalOrEmptySegment);
  });
};

export const DIAL_RESOURCE_ID_VALIDATION_MESSAGE =
  'must be a DIAL resource id without empty, dot, or dot-dot path segments ' +
  '(including when encoded), without backslashes, braces, quotes, query or ' +
  'fragment markers or control characters, and with valid percent-encoding';

/**
 * class-validator decorator for {@link isDialResourceId}.
 * @param validationOptions - standard class-validator options
 */
export const IsDialResourceId = (validationOptions?: ValidationOptions) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isDialResourceId',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: isDialResourceId,
        defaultMessage(args?: ValidationArguments) {
          return `${args?.property ?? propertyName} ${DIAL_RESOURCE_ID_VALIDATION_MESSAGE}`;
        },
      },
    });
  };
};

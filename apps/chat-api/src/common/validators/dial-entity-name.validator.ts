import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/*
 * Characters unsafe in a DIAL Core resource name. Three groups:
 *
 *   1. DIAL Core's own reject list for a resource name -- `:;,=/{}%&\"` plus
 *      the backslash. It must stay in sync with `NOT_ALLOWED_SYMBOLS` in
 *      `@epam/ai-dial-ui-kit` and with
 *      `PROHIBITED_CONVERSATION_NAME_CHARS_RE` in `libs/chat-shared`, which is
 *      what the rename input applies on the client. Leaving the backslash out
 *      let a LaTeX-style first prompt (`\frac{1}{1+x}`) produce a title Core
 *      rejects with 400 on every later read, delete and export, stranding the
 *      conversation.
 *   2. Tab, which the client-side list also strips.
 *   3. The null byte and the Unicode bidi codepoints that can spoof
 *      filenames (CWE-116). Backend-only hardening -- the client list does
 *      not carry these, so the two lists are equal only on groups 1 and 2.
 *
 * This backend copy is duplicated rather than imported because `chat-shared`
 * is a browser/React library that a Nest process must not pull in; the tests
 * in `conversations/tests/conversation-naming.spec.ts` pin the two lists
 * together. The regex is global so callers can `replace` every match; use
 * `isValidDialEntityName` for a stateless test.
 */
export const DIAL_ENTITY_NAME_FORBIDDEN_CHARS_RE =
  /[:;,=/\\{}%&"\t\0‎‏‪-‮⁦-⁩]/gu;

/** Upper bound of a DIAL resource name, in UTF-8 bytes. */
export const DIAL_ENTITY_NAME_MAX_BYTES = 255;

/** Names DIAL Core reserves for its own markers and segments. */
const RESERVED_NAMES = new Set([
  '.',
  '..',
  'v',
  'files',
  '.dial-resource',
  '.dial-folder',
]);

const FORBIDDEN_CHAR_TEST_RE = new RegExp(
  DIAL_ENTITY_NAME_FORBIDDEN_CHARS_RE.source,
  'u',
);
const CONTROL_CHAR_RE = /\p{Cc}/u;

/**
 * Returns `true` when `value` can be used verbatim as one DIAL resource name
 * segment: non-empty, no surrounding whitespace, at most
 * `DIAL_ENTITY_NAME_MAX_BYTES` UTF-8 bytes, no forbidden or control
 * character (so no `/` and no traversal), and not a Core-reserved name.
 */
export const isValidDialEntityName = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (value.trim() !== value) return false;
  if (Buffer.byteLength(value, 'utf8') > DIAL_ENTITY_NAME_MAX_BYTES) {
    return false;
  }
  if (FORBIDDEN_CHAR_TEST_RE.test(value) || CONTROL_CHAR_RE.test(value)) {
    return false;
  }
  return !RESERVED_NAMES.has(value);
};

export const DIAL_ENTITY_NAME_VALIDATION_MESSAGE =
  `must be 1-${DIAL_ENTITY_NAME_MAX_BYTES} UTF-8 bytes with no surrounding ` +
  'whitespace, control characters, or any of : ; , = / \\ { } % & ", ' +
  'and must not be a reserved name';

/** class-validator decorator for {@link isValidDialEntityName}. */
export const IsDialEntityName = (validationOptions?: ValidationOptions) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isDialEntityName',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: isValidDialEntityName,
        defaultMessage(args?: ValidationArguments) {
          return `${args?.property ?? propertyName} ${DIAL_ENTITY_NAME_VALIDATION_MESSAGE}`;
        },
      },
    });
  };
};

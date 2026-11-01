import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import { safeDecodeURIComponent } from '../utils/uri';

/*
 * A conversation path embeds the conversation title, which comes from the
 * user's first message, so a title like `Hi... there` is legitimate and puts
 * `..` inside a segment. Only a whole `.` or `..` segment is traversal, so
 * this checks segments rather than rejecting `..` anywhere (GitHub #9600).
 * Each segment is decoded once more, because `encodeDialResourcePath`
 * decodes before re-encoding and would otherwise turn `%2e%2e` into `..`.
 */
const isTraversalSegment = (segment: string): boolean =>
  segment === '.' || segment === '..';

/**
 * Returns `true` when `value` is a non-empty string with no `.` or `..` path
 * segment, raw or percent-encoded. Dots inside a segment stay valid.
 */
export const isConversationPath = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0) return false;

  return !value
    .split('/')
    .flatMap((segment) => safeDecodeURIComponent(segment).split('/'))
    .some(isTraversalSegment);
};

export const CONVERSATION_PATH_VALIDATION_MESSAGE =
  'path contains invalid characters';

/** class-validator decorator for {@link isConversationPath}. */
export const IsConversationPath = (validationOptions?: ValidationOptions) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isConversationPath',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: isConversationPath,
        defaultMessage(_args?: ValidationArguments) {
          return CONVERSATION_PATH_VALIDATION_MESSAGE;
        },
      },
    });
  };
};

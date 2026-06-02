import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { MessageCustomContentDto } from './message-custom-content.dto';

/**
 * Property decorator that passes when the decorated text field is a non-empty
 * string OR the DTO carries at least one attachment in
 * `custom_content.attachments`. Mirrors the client send-gating rule that allows
 * attachment-only messages with empty text.
 */
export function IsMessageOrAttachmentsPresent(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isMessageOrAttachmentsPresent',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const { custom_content } = args.object as {
            custom_content?: MessageCustomContentDto;
          };
          const hasText = typeof value === 'string' && value.trim().length > 0;
          const hasAttachments = (custom_content?.attachments?.length ?? 0) > 0;
          return hasText || hasAttachments;
        },
        defaultMessage(): string {
          return 'Either a non-empty message or at least one attachment is required';
        },
      },
    });
  };
}

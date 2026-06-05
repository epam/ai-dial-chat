import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { MessageCustomContentDto } from './message-custom-content.dto';

/**
 * Property decorator that passes when the decorated text field is a non-empty
 * string OR the DTO carries a DIAL custom payload that can stand in for text
 * (`attachments`, `form_value`, or `configuration_value`).
 */
export const IsMessageOrAttachmentsPresent = (
  validationOptions?: ValidationOptions,
) => {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isMessageOrAttachmentsPresent',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown, args: ValidationArguments): boolean => {
          const { custom_content } = args.object as {
            custom_content?: MessageCustomContentDto;
          };
          const hasNonEmptyObject = (v: unknown): boolean =>
            v != null && typeof v === 'object' && Object.keys(v).length > 0;
          const hasText = typeof value === 'string' && value.trim().length > 0;
          const hasAttachments = (custom_content?.attachments?.length ?? 0) > 0;
          const hasFormValue = hasNonEmptyObject(custom_content?.form_value);
          const hasConfigurationValue = hasNonEmptyObject(
            custom_content?.configuration_value,
          );

          return (
            hasText || hasAttachments || hasFormValue || hasConfigurationValue
          );
        },
        defaultMessage: (): string => {
          return 'Either a non-empty message or custom content is required';
        },
      },
    });
  };
};

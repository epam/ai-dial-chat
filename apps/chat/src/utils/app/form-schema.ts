import { TypeValidator } from '@/src/utils/app/typeValidator';

import { Conversation, FormButtonType } from '@/src/types/chat';

import {
  DialSchemaProperties,
  FormSchemaButtonOption,
  Message,
  MessageFormSchema,
  MessageFormValue,
} from '@epam/ai-dial-shared';
import { mapValues, omit } from 'lodash';

export const getMessageSchema = (message?: Message) =>
  message?.custom_content?.form_schema;
export const getMessageFormValue = (message?: Message) =>
  message?.custom_content?.form_value;

export const getConfigurationSchema = (message?: Message) =>
  message?.custom_content?.configuration_schema;
export const getConfigurationValue = (message?: Message) =>
  message?.custom_content?.configuration_value;

export const getConversationSchema = (conversation: Conversation) => {
  return getMessageSchema(
    conversation.messages[conversation.messages.length - 1],
  );
};

export const getFormButtonType = (option: FormSchemaButtonOption) => {
  if (option[DialSchemaProperties.DialWidgetOptions]?.submit)
    return FormButtonType.Submit;
  return FormButtonType.Populate;
};

export const isMessageInputDisabled = (
  messageIndex: number,
  messages: Message[],
) => {
  const schema =
    messageIndex === 0
      ? getConfigurationSchema(messages[0])
      : getMessageSchema(messages[messageIndex - 1]);

  return !!schema?.[DialSchemaProperties.DialChatMessageInputDisabled];
};

export const isConversationWithFormSchema = (conversation: Conversation) => {
  return (
    conversation.messages?.some(
      (message) =>
        !!getMessageSchema(message) ||
        !!getMessageFormValue(message) ||
        !!getConfigurationSchema(message),
    ) ?? false
  );
};

export const removeDescriptionsFromSchema = (
  schema: MessageFormSchema,
): MessageFormSchema => ({
  ...schema,
  properties: mapValues(schema.properties, (value) =>
    omit(value, ['description']),
  ),
});

export const getFormValueMissingProperties = (
  schema: MessageFormSchema,
  value: MessageFormValue,
) => {
  return schema.required?.filter((property) => !(property in value)) ?? [];
};

export const isFormValueValid = (
  schema: MessageFormSchema,
  value?: MessageFormValue,
) => {
  return !getFormValueMissingProperties(schema, value ?? {}).length;
};

export const isFormSchemaValid = TypeValidator.shape({
  type: TypeValidator.string(),
  required: TypeValidator.optional(TypeValidator.array(TypeValidator.string())),
  [DialSchemaProperties.DialChatMessageInputDisabled]: TypeValidator.optional(
    TypeValidator.boolean(),
  ),
  properties: TypeValidator.map(
    TypeValidator.string(),
    TypeValidator.shape({
      type: TypeValidator.string(),
      description: TypeValidator.optional(TypeValidator.string()),
      oneOf: TypeValidator.optional(
        TypeValidator.array(
          TypeValidator.shape({
            title: TypeValidator.string(),
            const: TypeValidator.number(),
            [DialSchemaProperties.DialWidgetOptions]: TypeValidator.optional(
              TypeValidator.shape({
                confirmationMessage: TypeValidator.optional(
                  TypeValidator.string(),
                ),
                populateText: TypeValidator.optional(TypeValidator.string()),
                submit: TypeValidator.optional(TypeValidator.boolean()),
              }),
            ),
          }),
        ),
      ),
    }),
  ),
});

export const getFormValueDefinitions = (
  value: MessageFormValue,
  schema?: MessageFormSchema,
) => {
  if (!schema || !isFormSchemaValid(schema)) return [];

  return Object.entries(value)
    .map(([key, value]) => {
      return schema.properties[key].oneOf?.find(
        (option) => option.const === value,
      );
    })
    .filter(Boolean) as FormSchemaButtonOption[];
};

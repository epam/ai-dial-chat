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

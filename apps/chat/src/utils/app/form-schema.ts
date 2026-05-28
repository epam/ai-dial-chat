import { TypeValidator } from '@/src/utils/app/typeValidator';

import { Conversation, FormButtonType } from '@/src/types/chat';
import {
  FormSchemaPropertyType,
  VisibleFormButtonRow,
  VisibleFormCheckboxRow,
  VisibleFormValueRow,
} from '@/src/types/form-schema';

import {
  DialSchemaProperties,
  FormSchemaButtonOption,
  FormSchemaDefinition,
  FormSchemaPropertyWidget,
  Message,
  MessageFormSchema,
  MessageFormValue,
} from '@epam/ai-dial-shared';
import { mapValues, omit } from 'lodash';
import get from 'lodash-es/get';

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
            description: TypeValidator.optional(TypeValidator.string()),
            const: TypeValidator.oneOfType([
              TypeValidator.number(),
              TypeValidator.string(),
              TypeValidator.boolean(),
            ]),
            [DialSchemaProperties.DialWidgetOptions]: TypeValidator.optional(
              TypeValidator.shape({
                confirmationMessage: TypeValidator.optional(
                  TypeValidator.string(),
                ),
                populateText: TypeValidator.optional(TypeValidator.string()),
                submit: TypeValidator.optional(TypeValidator.boolean()),
                showDescriptionInUserMessage: TypeValidator.optional(
                  TypeValidator.boolean(),
                ),
              }),
            ),
          }),
        ),
      ),
    }),
  ),
});

export const getChosenFormButtons = (
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

export const getFormCheckboxDefinitionOptions = (
  schema: MessageFormSchema,
  property: string,
) => {
  const path = schema.properties[property]?.items?.$ref;

  if (!path || !schema.definitions) return [];

  const formattedPath = path.replace('#/', '').replaceAll('/', '.');
  const definitions = get(
    { definitions: schema.definitions },
    formattedPath,
  ) as FormSchemaDefinition;

  return definitions.enum.map((value, i) => ({
    value,
    label: definitions.enumNames[i] ?? '',
  }));
};

export const getFormSchemaPropertyType = (
  schema: MessageFormSchema,
  property: string,
) => {
  if (
    schema.properties[property]?.[DialSchemaProperties.DialWidget] ===
    FormSchemaPropertyWidget.buttons
  ) {
    return FormSchemaPropertyType.Button;
  } else if (
    schema.properties[property]?.uniqueItems &&
    schema.properties[property]?.items?.$ref
  ) {
    return FormSchemaPropertyType.Checkbox;
  }
  return FormSchemaPropertyType.Unknown;
};

export const getSortedFormSchemaProperties = (schema: MessageFormSchema) => {
  const priorityByType = {
    [FormSchemaPropertyType.Checkbox]: 0,
    [FormSchemaPropertyType.Button]: 1,
    [FormSchemaPropertyType.Unknown]: 2,
  };

  return Object.entries(schema.properties).sort(
    (a, b) =>
      priorityByType[getFormSchemaPropertyType(schema, a[0])] -
      priorityByType[getFormSchemaPropertyType(schema, b[0])],
  );
};

export const getVisibleFormValues = (
  schema?: MessageFormSchema,
  value?: MessageFormValue,
): VisibleFormValueRow[] => {
  if (!schema || !value) return [];

  return getSortedFormSchemaProperties(schema).map(([key, property]) => {
    const type = getFormSchemaPropertyType(schema, key);
    const info = {
      property: key,
      description: property.description,
    };

    if (type === FormSchemaPropertyType.Button) {
      const row: VisibleFormButtonRow = {
        ...info,
        type: FormSchemaPropertyType.Button,
        options:
          property.oneOf?.map((option) => ({
            label: option.title,
            value: option.const,
            description: option.description,
            showDescriptionInUserMessage:
              option[DialSchemaProperties.DialWidgetOptions]
                ?.showDescriptionInUserMessage === true,
            selected: value[key] === option.const,
            buttonType: getFormButtonType(option),
          })) ?? [],
      };

      return row;
    }

    const row: VisibleFormCheckboxRow = {
      ...info,
      type: FormSchemaPropertyType.Checkbox,
      options: getFormCheckboxDefinitionOptions(schema, key).map((option) => ({
        ...option,
        buttonType: null,
        selected: (value[key] as string[])?.includes(option.value),
      })),
    };

    return row;
  });
};

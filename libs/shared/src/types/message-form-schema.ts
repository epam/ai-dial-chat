import { JSONSchemaBase, JSONSchemaPropertyBase } from './json-schema';

export enum FormSchemaPropertyWidget {
  buttons = 'buttons',
}

export enum DialSchemaProperties {
  DialWidgetOptions = 'dial:widgetOptions',
  DialWidget = 'dial:widget',
  DialChatMessageInputDisabled = 'dial:chatMessageInputDisabled',
}

export type MessageFormValueType = number | string | boolean | string[];

export interface FormSchemaButtonOption {
  title: string;
  const: Exclude<MessageFormValueType, string[]>;
  description?: string;
  [DialSchemaProperties.DialWidgetOptions]?: {
    confirmationMessage?: string;
    populateText?: string;
    submit?: boolean;
    /** When `true`, option `description` is shown in read-only user messages. Defaults to `false`. */
    showDescriptionInUserMessage?: boolean;
  };
}

export interface FormSchemaDefinition {
  enumNames: string[];
  enum: string[];
}

export type MessageFormValue = Record<string, MessageFormValueType | undefined>;

export interface FormSchemaProperty extends JSONSchemaPropertyBase {
  [DialSchemaProperties.DialWidget]?: FormSchemaPropertyWidget;
  oneOf?: FormSchemaButtonOption[];
  uniqueItems?: boolean;
  items?: {
    $ref: string;
  };
}

export interface MessageFormSchema extends JSONSchemaBase<FormSchemaProperty> {
  [DialSchemaProperties.DialChatMessageInputDisabled]?: boolean;
  definitions?: Record<string, FormSchemaDefinition>;
}

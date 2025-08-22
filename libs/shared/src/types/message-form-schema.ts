import { JSONSchemaBase, JSONSchemaPropertyBase } from './json-schema';

export enum FormSchemaPropertyWidget {
  buttons = 'buttons',
}

export enum DialSchemaProperties {
  DialWidgetOptions = 'dial:widgetOptions',
  DialWidget = 'dial:widget',
  DialChatMessageInputDisabled = 'dial:chatMessageInputDisabled',
}

export type MessageFormValueType = number | string | boolean;

export interface FormSchemaButtonOption {
  title: string;
  const: MessageFormValueType;
  [DialSchemaProperties.DialWidgetOptions]?: {
    confirmationMessage?: string;
    populateText?: string;
    submit?: boolean;
  };
}

export type MessageFormValue = Record<string, MessageFormValueType | undefined>;

export interface FormSchemaProperty extends JSONSchemaPropertyBase {
  [DialSchemaProperties.DialWidget]?: FormSchemaPropertyWidget;
  oneOf?: FormSchemaButtonOption[];
}

export interface MessageFormSchema extends JSONSchemaBase<FormSchemaProperty> {
  [DialSchemaProperties.DialChatMessageInputDisabled]?: boolean;
}

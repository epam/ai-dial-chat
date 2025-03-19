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

export enum FormSchemaPropertyType {
  array = 'array',
  number = 'number',
  type = 'integer',
  string = 'string',
  boolean = 'boolean',
}

export interface FormSchemaProperty {
  [DialSchemaProperties.DialWidget]?: FormSchemaPropertyWidget;
  oneOf?: FormSchemaButtonOption[];
  description?: string;
  type: FormSchemaPropertyType;
}

export interface MessageFormSchema {
  type: 'object';
  required?: string[];
  [DialSchemaProperties.DialChatMessageInputDisabled]?: boolean;
  properties: Record<string, FormSchemaProperty>;
}

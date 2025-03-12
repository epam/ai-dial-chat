export enum FormSchemaPropertyWidget {
  buttons = 'buttons',
}

export enum DialSchemaProperties {
  DialWidgetOptions = 'dial:widgetOptions',
  DialWidget = 'dial:widget',
  DialChatMessageInputDisabled = 'dial:chatMessageInputDisabled',
}

export interface FormSchemaButtonOption {
  title: string;
  const: number;
  [DialSchemaProperties.DialWidgetOptions]?: {
    confirmationMessage?: string;
    populateText?: string;
    submit?: boolean;
  };
}

export type MessageFormValueType = string[] | number | undefined;

export type MessageFormValue = Record<string, MessageFormValueType>;

export enum FormSchemaPropertyType {
  array = 'array',
  number = 'number',
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

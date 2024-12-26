export enum FormSchemaPropertyWidget {
  buttons = 'buttons',
}

export interface FormSchemaButtonOption {
  title: string;
  const: number;
  'dial:widgetOptions'?: {
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
  'dial:widget'?: FormSchemaPropertyWidget;
  oneOf?: FormSchemaButtonOption[];
  description?: string;
  type: FormSchemaPropertyType;
}

export interface MessageFormSchema {
  type: 'object';
  required?: string[];
  'dial:chatMessageInputDisabled'?: boolean;
  properties: Record<string, FormSchemaProperty>;
}

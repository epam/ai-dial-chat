export enum DialWidgets {
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

export type FormSchemaPropertyType =
  | 'array'
  | 'boolean'
  | 'number'
  | 'object'
  | 'string';

export interface FormSchemaProperty {
  'dial:widget'?: DialWidgets;
  oneOf?: FormSchemaButtonOption[];
  description?: string;
  type: FormSchemaPropertyType;
}

export interface DialMessageFormSchema {
  type: 'object';
  required?: string[];
  'dial:chatMessageInputDisabled'?: boolean;
  properties: Record<string, FormSchemaProperty>;
}

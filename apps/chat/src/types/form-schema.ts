import { FormButtonType } from '@/src/types/chat';

import { MessageFormValueType } from '@epam/ai-dial-shared';

export enum FormSchemaPropertyType {
  Button = 'button',
  Checkbox = 'checkbox',
  Unknown = 'unknown',
}

export interface VisibleFormButtonOption {
  label: string;
  value: MessageFormValueType;
  description?: string;
  showDescriptionInUserMessage: boolean;
  selected: boolean;
  buttonType: FormButtonType;
}

export interface VisibleFormCheckboxOption {
  label: string;
  value: string;
  selected: boolean;
  buttonType: null;
}

interface VisibleFormValueRowBase {
  property: string;
  description?: string;
}

export interface VisibleFormButtonRow extends VisibleFormValueRowBase {
  type: FormSchemaPropertyType.Button;
  options: VisibleFormButtonOption[];
}

export interface VisibleFormCheckboxRow extends VisibleFormValueRowBase {
  type: FormSchemaPropertyType.Checkbox;
  options: VisibleFormCheckboxOption[];
}

export type VisibleFormValueRow = VisibleFormButtonRow | VisibleFormCheckboxRow;

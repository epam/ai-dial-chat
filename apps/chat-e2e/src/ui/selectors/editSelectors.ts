import { Attributes, Tags } from '@/src/ui/domData';

export const EditSelectors = {
  editContainer: '[data-qa="edit-container"]',
  editInput: `${Tags.input}[${Attributes.name}="edit-input"]`,
  editInputValue: (value: string) => `[${Attributes.value}="${value}"]`,
  actionButton: '[data-qa="action-button"]',
};

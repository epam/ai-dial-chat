import { Attributes, Tags } from '@/src/ui/domData';

export const EditSelectors = {
  editContainer: '[data-qa="edit-container"]',
  editInput: `${Tags.input}[${Attributes.name}="edit-input"]`,
  actionsContainer: '[data-qa="actions"]',
  confirmEdit: '[data-qa="confirm-edit"]',
  cancelEdit: '[data-qa="cancel-edit"]',
};

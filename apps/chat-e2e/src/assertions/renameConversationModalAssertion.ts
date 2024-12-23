import { BaseAssertion } from '@/src/assertions/baseAssertion';
import { RenameConversationModal } from '@/src/ui/webElements/renameConversationModal';
import { expect } from '@playwright/test';

export class RenameConversationModalAssertion extends BaseAssertion {
  readonly renameModal: RenameConversationModal;

  constructor(renameModal: RenameConversationModal) {
    super();
    this.renameModal = renameModal;
  }

  async assertModalIsVisible() {
    await this.assertElementState(
      this.renameModal.getElementLocator(),
      'visible',
      'Rename Conversation Modal should be visible',
    );
  }

  async assertModalTitle(expectedTitle: string) {
    await expect
      .soft(
        this.renameModal.title.getElementLocator(),
        'Rename Conversation Modal title should match',
      )
      .toHaveText(expectedTitle);
  }

  async assertInputValue(expectedValue: string) {
    await expect
      .soft(
        this.renameModal.nameInput.getElementLocator(),
        'Rename Conversation Modal input value should match',
      )
      .toHaveText(expectedValue);
  }

  async assertSaveButtonIsEnabled() {
    await expect
      .soft(
        this.renameModal.saveButton.getElementLocator(),
        'Save button should be enabled',
      )
      .toBeEnabled();
  }

  async assertSaveButtonIsDisabled() {
    await expect
      .soft(
        this.renameModal.saveButton.getElementLocator(),
        'Save button should be disabled',
      )
      .toBeDisabled();
  }
}

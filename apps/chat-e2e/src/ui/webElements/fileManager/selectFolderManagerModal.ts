import { PopupSelectors } from '@/src/ui/selectors';
import { BaseFileManagerModal } from '@/src/ui/webElements';
import { Button } from '@/src/ui/webElements/common/button';
import { Locator, Page } from '@playwright/test';

/**
 * Simplified folder selection modal (new FileManager-based UI).
 * Used when selecting destination folder for upload/move operations.
 * Appears via "Upload from device" → "Change location" flow.
 *
 * Inherits from Popup: close button ("Close dialog") and cancel button are inherited.
 */
export class SelectFolderManagerModal extends BaseFileManagerModal {
  private selectFolderButton!: Button;
  private addFolderButton!: Button;

  constructor(page: Page) {
    super(page);
  }

  /**
   * SelectFolderManagerModal uses [aria-label="popup-description"] as content container
   * (no [data-qa="file-manager"] wrapper).
   */
  protected override getFileManagerContentLocator(): Locator {
    return this.rootLocator.locator(PopupSelectors.popupContent);
  }

  /**
   * Gets the "Select folder" button in footer (confirm selection).
   */
  getSelectFolderButton(): Button {
    if (!this.selectFolderButton) {
      this.selectFolderButton = new Button(
        this.page,
        'Select folder',
        this.rootLocator,
      );
    }
    return this.selectFolderButton;
  }

  /**
   * Gets the "Add folder" button in the footer.
   */
  getAddFolderButton(): Button {
    if (!this.addFolderButton) {
      this.addFolderButton = new Button(
        this.page,
        'Add folder',
        this.rootLocator,
      );
    }
    return this.addFolderButton;
  }
}

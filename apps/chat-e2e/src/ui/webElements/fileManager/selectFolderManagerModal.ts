import { SelectFolderManagerModalSelectors } from '@/src/ui/selectors';
import { Button } from '@/src/ui/webElements/common/button';
import { Page } from '@playwright/test';
import { BaseFileManagerModal } from './baseFileManagerModal';

/**
 * Simplified folder selection modal (new FileManager-based UI).
 * Used when selecting destination folder for upload/move operations.
 * Appears via "Upload from device" → "Change location" flow.
 * 
 * Root selector: [role="dialog"] with heading "Select folder"
 * 
 * NOTE: This is the NEW class for the refactored FileManager modal.
 * The old SelectFolderModal class still exists for backward compatibility.
 */
export class SelectFolderManagerModal extends BaseFileManagerModal {
  private selectFolderButton!: Button;
  private cancelButton!: Button;

  constructor(page: Page) {
    // Find dialog with specific heading text
    const dialogLocator = page
      .locator(SelectFolderManagerModalSelectors.dialogRole)
      .filter({
        has: page.locator(
          `${SelectFolderManagerModalSelectors.headingId}:has-text("${SelectFolderManagerModalSelectors.headingText}")`
        ),
      });
    super(page, '', dialogLocator);
  }

  /**
   * Gets the "Select folder" button in footer (confirm selection).
   * This is different from FileManagerModal's "Select file" button.
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
   * Gets the "Cancel" button in footer.
   */
  getCancelButton(): Button {
    if (!this.cancelButton) {
      this.cancelButton = new Button(
        this.page,
        'Cancel',
        this.rootLocator,
      );
    }
    return this.cancelButton;
  }

  /**
   * Alias for getSelectFolderButton() - for compatibility with existing tests.
   */
  getSelectButton(): Button {
    return this.getSelectFolderButton();
  }
}

import { FileManager, FileManagerModalHeader } from '@/src/ui/webElements';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Button } from '@/src/ui/webElements/common/button';
import { Locator, Page } from '@playwright/test';

/**
 * Abstract base class for File Manager modals.
 * Provides shared functionality for both full FileManagerModal and simplified SelectFolderModal.
 */
export abstract class BaseFileManagerModal extends BaseElement {
  private closeButton!: Button;
  private addFolderButton!: Button;
  private header!: FileManagerModalHeader;
  private fileManager!: FileManager;

  constructor(page: Page, selector: string);
  constructor(page: Page, selector: string, locator: Locator);
  constructor(
    page: Page,
    selectorOrLocator: string | Locator,
    locator?: Locator,
  ) {
    // If first param is Locator, pass empty string + locator to BaseElement
    if (typeof selectorOrLocator !== 'string') {
      super(page, '', selectorOrLocator);
    } else {
      // Otherwise pass selector + optional locator
      super(page, selectorOrLocator, locator);
    }
  }

  /**
   * Gets the close button (X button in header).
   * Present in both FileManagerModal and SelectFolderModal.
   */
  getCloseButton(): Button {
    if (!this.closeButton) {
      this.closeButton = new Button(this.page, 'close', this.rootLocator);
    }
    return this.closeButton;
  }

  /**
   * Gets the "Add folder" button in the footer.
   * NOTE: This button appears in both modals but has different contexts:
   * - FileManagerModal: Only when opened via "Upload from device" flow
   * - SelectFolderModal: Always present in footer
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

  /**
   * Gets the modal header component.
   */
  getHeader(): FileManagerModalHeader {
    if (!this.header) {
      this.header = new FileManagerModalHeader(this.page, this.rootLocator);
    }
    return this.header;
  }

  /**
   * Gets the File Manager component (includes grid, navigation, etc.).
   */
  getFileManager(): FileManager {
    if (!this.fileManager) {
      this.fileManager = new FileManager(this.page, this.rootLocator);
    }
    return this.fileManager;
  }
}

import { FileManagerSelectors } from '@/src/ui/selectors';
import { FileManager, FileManagerModalHeader } from '@/src/ui/webElements';
import { Popup } from '@/src/ui/webElements/common/popup';
import { Locator, Page } from '@playwright/test';

/**
 * Abstract base class for File Manager like modals.
 * Provides shared functionality for both full FileManagerModal and SelectFolderManagerModal.
 *
 * Each subclass provides a unique selector via super(page, selector) to avoid
 * strict mode violations when multiple dialogs are open simultaneously
 * (e.g. FileManager + ConfirmationPopup).
 */
export abstract class BaseFileManagerModal extends Popup {
  private _header!: FileManagerModalHeader;
  private fileManager!: FileManager;

  protected constructor(page: Page, selector: string) {
    super(page, selector);
  }

  /**
   * Returns the locator for the FileManager content area.
   * Override in subclasses to provide the correct content container.
   * Default: [data-qa="file-manager"] (used by FileManagerModal).
   */
  protected getFileManagerContentLocator(): Locator {
    return this.rootLocator.locator(FileManagerSelectors.container);
  }

  /**
   * Gets the modal header component.
   */
  getHeader(): FileManagerModalHeader {
    if (!this._header) {
      this._header = new FileManagerModalHeader(this.page, this.rootLocator);
    }
    return this._header;
  }

  /**
   * Gets the File Manager component (includes grid, navigation, etc.).
   */
  getFileManager(): FileManager {
    if (!this.fileManager) {
      this.fileManager = new FileManager(
        this.page,
        this.getFileManagerContentLocator(),
      );
    }
    return this.fileManager;
  }
}

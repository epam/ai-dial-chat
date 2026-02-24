import { FileManager, FileManagerModalHeader } from '@/src/ui/webElements';
import { Popup } from '@/src/ui/webElements/common/popup';
import { Page } from '@playwright/test';

/**
 * Abstract base class for File Manager modals.
 * Extends Popup ([role="dialog"][aria-modal="true"]).
 * Provides shared functionality for both full FileManagerModal and simplified SelectFolderManagerModal.
 */
export abstract class BaseFileManagerModal extends Popup {
  private _header!: FileManagerModalHeader;
  private fileManager!: FileManager;

  protected constructor(page: Page) {
    super(page);
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
      this.fileManager = new FileManager(this.page, this.rootLocator);
    }
    return this.fileManager;
  }
}

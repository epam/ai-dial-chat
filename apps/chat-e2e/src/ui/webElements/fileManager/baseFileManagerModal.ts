import { FileManagerSelectors } from '@/src/ui/selectors';
import { FileManager } from '@/src/ui/webElements';
import { Popup } from '@/src/ui/webElements/common/popup';
import { Locator, Page } from '@playwright/test';

/**
 * Abstract base class for File Manager like modals.
 * Provides shared functionality for both full FileManagerModal and SelectFolderManagerModal.
 */
export abstract class BaseFileManagerModal extends Popup {
  private fileManager!: FileManager;

  protected constructor(page: Page) {
    super(page);
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

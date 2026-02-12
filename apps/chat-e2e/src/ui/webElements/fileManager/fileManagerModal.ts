import { UploadMenuOptions } from '@/src/testData';
import { FileManagerModalSelectors } from '@/src/ui/selectors';
import { Button } from '@/src/ui/webElements/common/button';
import { Page } from '@playwright/test';
import { BaseFileManagerModal } from './baseFileManagerModal';

/**
 * Full-featured File Manager Modal.
 * Used for file/folder selection and management with complete toolbar.
 * Root selector: [data-qa="file-manager-modal"]
 */
export class FileManagerModal extends BaseFileManagerModal {
  private attachButton!: Button;
  private selectButton!: Button;

  constructor(page: Page) {
    super(page, FileManagerModalSelectors.modalContainer);
  }

  /**
   * Gets the "Attach" button (specific to full FileManagerModal).
   */
  getAttachButton(): Button {
    if (!this.attachButton) {
      this.attachButton = new Button(this.page, 'Attach', this.rootLocator);
    }
    return this.attachButton;
  }

  /**
   * Gets the "Select file" button (specific to full FileManagerModal).
   */
  getSelectButton(): Button {
    if (!this.selectButton) {
      this.selectButton = new Button(
        this.page,
        'Select file',
        this.rootLocator,
      );
    }
    return this.selectButton;
  }

  public title = this.getChildElementBySelector(
    FileManagerModalSelectors.title,
  );
  public modalTitle = this.getChildElementBySelector(
    FileManagerModalSelectors.title,
  );

  public async openUploadFromDevice() {
    await this.getFileManager().getFileManagerToolbar().getNewButton().click();
    await this.getFileManager()
      .getFileManagerToolbar()
      .getNewButtonDropdownMenu()
      .selectItem(UploadMenuOptions.uploadFiles);
  }
}

import { UploadMenuOptions } from '@/src/testData';
import { FileManagerModalSelectors } from '@/src/ui/selectors';
import { BaseFileManagerModal } from '@/src/ui/webElements';
import { Button } from '@/src/ui/webElements/common/button';
import { Page } from '@playwright/test';

/**
 * Full-featured File Manager Modal.
 * Uses [data-qa="file-manager-modal"] as unique selector (from Modal.tsx).
 */
export class FileManagerModal extends BaseFileManagerModal {
  private attachButton!: Button;
  private selectButton!: Button;
  private closeModalBtn!: Button;

  constructor(page: Page) {
    super(page, FileManagerModalSelectors.modalContainer);
  }

  /**
   * Override: FileManagerModal uses aria-label="close" (Modal.tsx),
   * while default is aria-label="Close dialog" (UI kit).
   */
  override getCloseButton(): Button {
    if (!this.closeModalBtn) {
      this.closeModalBtn = new Button(this.page, 'close', this.rootLocator);
    }
    return this.closeModalBtn;
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

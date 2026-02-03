import { UploadMenuOptions } from '@/src/testData';
import { FileManagerModalSelectors } from '@/src/ui/selectors';
import { FileManager, FileManagerModalHeader } from '@/src/ui/webElements';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Button } from '@/src/ui/webElements/common/button';
import { Page } from '@playwright/test';

export class FileManagerModal extends BaseElement {
  constructor(page: Page) {
    super(page, FileManagerModalSelectors.modalContainer);
  }
  private closeButton!: Button;
  private attachButton!: Button;
  private selectButton!: Button;
  private header!: FileManagerModalHeader;
  private fileManager!: FileManager;

  getCloseButton(): Button {
    if (!this.closeButton) {
      this.closeButton = new Button(this.page, 'close', this.rootLocator);
    }
    return this.closeButton;
  }

  getAttachButton(): Button {
    if (!this.attachButton) {
      this.attachButton = new Button(this.page, 'Attach', this.rootLocator);
    }
    return this.attachButton;
  }

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

  getHeader(): FileManagerModalHeader {
    if (!this.header) {
      this.header = new FileManagerModalHeader(this.page, this.rootLocator);
    }
    return this.header;
  }

  getFileManager(): FileManager {
    if (!this.fileManager) {
      this.fileManager = new FileManager(this.page, this.rootLocator);
    }
    return this.fileManager;
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

import { FilesManagerModalSelectors } from '@/src/ui/selectors';
import { FilesManager, FilesManagerModalHeader } from '@/src/ui/webElements';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Button } from '@/src/ui/webElements/common/button';
import { Page } from '@playwright/test';

export class FilesManagerModal extends BaseElement {
  constructor(page: Page) {
    super(page, FilesManagerModalSelectors.modalContainer);
  }
  private closeButton!: Button;
  private attachButton!: Button;
  private header!: FilesManagerModalHeader;
  private filesManager!: FilesManager;

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

  getHeader(): FilesManagerModalHeader {
    if (!this.header) {
      this.header = new FilesManagerModalHeader(this.page, this.rootLocator);
    }
    return this.header;
  }

  getFilesManager(): FilesManager {
    if (!this.filesManager) {
      this.filesManager = new FilesManager(this.page, this.rootLocator);
    }
    return this.filesManager;
  }

  public title = this.getChildElementBySelector(
    FilesManagerModalSelectors.title,
  );
  public modalTitle = this.getChildElementBySelector(
    FilesManagerModalSelectors.title,
  );
}

import {
  ErrorLabelSelectors,
  IconSelectors,
  SelectFolderModalSelectors,
} from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Folders } from '@/src/ui/webElements/folders';
import { Page } from '@playwright/test';

export class SelectFolderModal extends BaseElement {
  constructor(page: Page) {
    super(page, SelectFolderModalSelectors.modalContainer);
  }

  private uploadFolder!: Folders;

  public allFoldersSection = this.getChildElementBySelector(
    SelectFolderModalSelectors.allFolders,
  );

  public selectFolderErrorText = this.getChildElementBySelector(
    ErrorLabelSelectors.errorText,
  );

  public closeModal = this.getChildElementBySelector(IconSelectors.cancelIcon);

  getUploadFolder() {
    if (!this.uploadFolder) {
      this.uploadFolder = new Folders(
        this.page,
        this.getElementLocator(),
        SelectFolderModalSelectors.uploadFolders,
      );
    }
    return this.uploadFolder;
  }

  public newFolderButton = this.getChildElementBySelector(
    SelectFolderModalSelectors.newFolderButton,
  );

  public selectFolderButton = this.getChildElementBySelector(
    SelectFolderModalSelectors.selectFolderButton,
  );
}

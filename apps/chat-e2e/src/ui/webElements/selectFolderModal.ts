import { API } from '@/src/testData';
import {
  ErrorLabelSelectors,
  IconSelectors,
  SelectFolderModalSelectors,
} from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Folders } from '@/src/ui/webElements/entityTree/folders';
import { Page } from '@playwright/test';

export class SelectFolderModal extends BaseElement {
  constructor(page: Page) {
    super(page, SelectFolderModalSelectors.modalContainer);
  }

  private selectFolders!: Folders;

  public allFoldersSection = this.getChildElementBySelector(
    SelectFolderModalSelectors.allFolders,
  );

  public rootFolder = this.getChildElementBySelector(
    SelectFolderModalSelectors.rootFolder,
  );

  public selectFolderErrorText = this.getChildElementBySelector(
    ErrorLabelSelectors.errorText,
  );

  public closeModal = this.getChildElementBySelector(IconSelectors.cancelIcon);

  getSelectFolders() {
    if (!this.selectFolders) {
      this.selectFolders = new Folders(
        this.page,
        this.getElementLocator(),
        SelectFolderModalSelectors.selectFolders,
      );
    }
    return this.selectFolders;
  }

  public newFolderButton = this.getChildElementBySelector(
    SelectFolderModalSelectors.newFolderButton,
  );

  public selectFolderButton = this.getChildElementBySelector(
    SelectFolderModalSelectors.selectFolderButton,
  );

  public async selectFolder(folderName: string) {
    const respPremise = this.page.waitForResponse((r) =>
      r.request().url().includes(API.listingHost),
    );
    await this.getSelectFolders().getFolderName(folderName).click();
    await respPremise;
  }

  public async selectRootFolder() {
    const respPremise = this.page.waitForResponse((r) =>
      r.request().url().includes(API.listingHost),
    );
    await this.rootFolder.click();
    await respPremise;
  }
}

import {
  ErrorLabelSelectors,
  IconSelectors,
  SelectFolderModalSelectors,
} from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Folders } from '@/src/ui/webElements/entityTree/folders';
import { Page } from '@playwright/test';
import { Response } from 'playwright-core';

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

  public searchInput = this.getChildElementBySelector(
    SelectFolderModalSelectors.searchInput,
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

  public async selectFolder(
    folderName: string,
    { triggeredApiHost }: { triggeredApiHost?: string } = {},
  ) {
    const folderToSelect = this.getSelectFolders().getFolderName(folderName);
    let respPremise: Promise<Response>;
    if (triggeredApiHost) {
      respPremise = this.page.waitForResponse((r) =>
        r.request().url().includes(triggeredApiHost!),
      );
      await folderToSelect.click();
      await respPremise;
    } else {
      await folderToSelect.click();
    }
  }

  public async selectRootFoldersSection({
    triggeredApiHost,
  }: {
    triggeredApiHost?: string;
  } = {}) {
    if (triggeredApiHost) {
      const respPremise = this.page.waitForResponse((r) =>
        r.request().url().includes(triggeredApiHost),
      );
      await this.rootFolder.click();
      await respPremise;
    } else {
      await this.rootFolder.click();
    }
  }

  public async clickSelectFolderButton({
    triggeredApiHost = undefined,
  }: {
    triggeredApiHost?: string;
  } = {}) {
    if (triggeredApiHost) {
      const respPremise = this.page.waitForResponse((r) =>
        r.request().url().includes(triggeredApiHost),
      );
      await this.selectFolderButton.click();
      await respPremise;
    } else {
      await this.selectFolderButton.click();
    }
  }
}

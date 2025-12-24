import { API } from '@/src/testData';
import { FolderTreeSelectors, IconSelectors } from '@/src/ui/selectors';
import { BaseElement, Dropdown } from '@/src/ui/webElements';
import { RegexUtil } from '@/src/utils';
import { Locator, Page } from '@playwright/test';

export class FoldersTree extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, FolderTreeSelectors.foldersTreeContainer, parentLocator);
  }

  private folderDropdown!: Dropdown;

  getFolderDropdown(): Dropdown {
    if (!this.folderDropdown) {
      this.folderDropdown = new Dropdown(this.page);
    }
    return this.folderDropdown;
  }

  public folders = this.getChildElementBySelector(FolderTreeSelectors.folder);

  public folderByPath = (...path: string[]): Locator => {
    if (path.length === 0) {
      throw new Error('Folder path cannot be empty');
    }
    let currentLocator = this.rootLocator;
    for (const folderName of path) {
      const hasNameLocator = this.page.locator(FolderTreeSelectors.folderName, {
        hasText: new RegExp(`^${RegexUtil.escapeRegexChars(folderName)}$`),
      });
      const hasAnotherFolderWithSameNameLocator = this.page.locator(
        FolderTreeSelectors.folder,
        { has: hasNameLocator },
      );
      currentLocator = currentLocator
        .locator(FolderTreeSelectors.folder)
        .filter({ has: hasNameLocator })
        .filter({ hasNot: hasAnotherFolderWithSameNameLocator });
    }
    return currentLocator;
  };

  public folderNameByPath = (...path: string[]): Locator => {
    return this.folderByPath(...path).locator(FolderTreeSelectors.folderName);
  };

  public async expandFolder(...path: string[]) {
    const respPromise = this.page.waitForResponse(
      (resp) =>
        resp
          .url()
          .endsWith(API.folderFilesListingHost(path[path.length - 1])) &&
        resp.ok(),
    );
    await this.folderByPath(...path)
      .locator(IconSelectors.caretIcon)
      .click();
    await respPromise;
  }

  public async expandFolders(...path: string[]) {
    const folderToExpandPath = [path[0]];
    for (let i = 0; i < path.length; i++) {
      await this.expandFolder(...folderToExpandPath);
      folderToExpandPath.push(path[i + 1]);
    }
  }
}

import { FolderTreeSelectors } from '@/src/ui/selectors';
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

  private filterFolderByName = (
    parentLocator: Locator | BaseElement,
    name: string,
  ): Locator => {
    return BaseElement.getElementLocator(parentLocator).filter({
      has: this.page.locator(FolderTreeSelectors.folderName, {
        hasText: new RegExp(`^${RegexUtil.escapeRegexChars(name)}$`),
      }),
    });
  };

  public folderByPath = (...path: string[]): Locator => {
    if (path.length === 0) {
      throw new Error('Folder path cannot be empty');
    }
    //start with root folder
    let currentLocator = this.filterFolderByName(this.folders, path[0]);
    for (let i = 1; i < path.length; i++) {
      const childFolders = currentLocator.locator(FolderTreeSelectors.folder);
      currentLocator = this.filterFolderByName(childFolders, path[i]);
    }
    return currentLocator;
  };

  public async selectFolder(...path: string[]) {
    await this.folderByPath(...path).click();
  }
}

import { API } from '@/src/testData';
import { FolderTreeSelectors, IconSelectors } from '@/src/ui/selectors';
import { BaseElement, Dropdown, Input } from '@/src/ui/webElements';
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

  public folderByPathCaret = (...path: string[]) =>
    this.folderByPath(...path)
      .locator(IconSelectors.caretIcon)
      .nth(0);

  public folderNameByPath = (...path: string[]): Locator => {
    return this.folderByPath(...path).locator(FolderTreeSelectors.folderName);
  };

  public folderGroupByPath = (...path: string[]): Locator => {
    return this.folderByPath(...path)
      .locator(FolderTreeSelectors.folderGroup)
      .first();
  };

  public async expandFolder(
    options: { isFilesListingTriggered: boolean },
    ...path: string[]
  ) {
    if (options.isFilesListingTriggered) {
      const respPromise = this.page.waitForResponse(
        (resp) =>
          resp
            .url()
            .endsWith(API.folderFilesListingHost(path[path.length - 1])) &&
          resp.ok(),
      );
      await this.folderByPathCaret(...path).click();
      await respPromise;
    } else {
      await this.folderByPathCaret(...path).click();
    }
  }

  public getRenameInput(): BaseElement {
    return new Input(this.page, this.rootLocator).inputField;
  }

  public async openFolderDotsMenu(...path: string[]) {
    const folderItem = this.folderByPath(...path);
    await folderItem.hover();
    await folderItem.locator(IconSelectors.dotsMenuIcon).click();
  }

  public async expandFolders(
    options: { isFilesListingTriggered: boolean },
    ...path: string[]
  ) {
    const folderToExpandPath = [path[0]];
    for (let i = 0; i < path.length; i++) {
      await this.expandFolder(options, ...folderToExpandPath);
      folderToExpandPath.push(path[i + 1]);
    }
  }
}

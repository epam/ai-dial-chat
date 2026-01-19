import { API, FileManagerColumnKey, MenuOptions } from '@/src/testData';
import {
  GridSelectors,
  IconSelectors,
  InputSelectors,
} from '@/src/ui/selectors';
import { Checkbox, Dropdown, Grid } from '@/src/ui/webElements';
import { FileUtil } from '@/src/utils';
import { Locator, Page } from '@playwright/test';

export class FilesManagerGrid extends Grid {
  public rowDropdownMenu!: Dropdown;

  constructor(page: Page, parentLocator: Locator) {
    super(page, parentLocator);
  }

  getRowDropdownMenu() {
    if (!this.rowDropdownMenu) {
      this.rowDropdownMenu = new Dropdown(this.page);
    }
    return this.rowDropdownMenu;
  }

  public gridHeaderCheckbox = new Checkbox(
    this.page,
    this.gridHeaderColumn(FileManagerColumnKey.Select).getElementLocator(),
  );

  public gridRowByNameCell = (name: string) =>
    this.gridRowByCellValue(FileManagerColumnKey.Name, name);

  public gridDotsMenuByNameCell = (name: string) =>
    this.gridRowByNameCell(name)
      .locator(GridSelectors.gridCell(FileManagerColumnKey.Actions))
      .locator(IconSelectors.dotsMenuIcon);

  public gridCheckboxByNameCell = (name: string) =>
    new Checkbox(
      this.page,
      this.gridRowByNameCell(name).locator(
        GridSelectors.gridCell(FileManagerColumnKey.Select),
      ),
    );

  public gridNameCell = (name: string) =>
    this.gridRowColumnByCellValue(FileManagerColumnKey.Name, name);

  public gridNameCellValue = (name: string) =>
    this.gridNameCell(name).locator(GridSelectors.gridCellValue);

  /**
   * Opens a folder by clicking on its name cell
   * @param folderName Name of the folder to open
   * @param waitForRequest Whether to wait for GET request to load folder contents (default: true)
   */
  public async openFolder(folderName: string, waitForRequest = true) {
    if (waitForRequest) {
      const requestPromise = this.page.waitForResponse(
        (resp) =>
          resp.url().endsWith(API.folderFilesListingHost(folderName)) &&
          resp.request().method() === 'GET' &&
          resp.ok(),
      );
      await this.gridNameCellValue(folderName).click();
      await requestPromise;
    } else {
      await this.gridNameCellValue(folderName).click();
    }
  }

  public async renameFile(currentName: string, newName: string) {
    await this.gridDotsMenuByNameCell(currentName).click();
    await this.getRowDropdownMenu().selectItem(MenuOptions.rename);
    const nameWithoutExtension =
      FileUtil.getFilenameWithoutExtension(currentName);
    const input = this.getElementLocator().locator(
      InputSelectors.value(nameWithoutExtension),
    );
    await input.fill(newName);
    await this.click();
  }
}

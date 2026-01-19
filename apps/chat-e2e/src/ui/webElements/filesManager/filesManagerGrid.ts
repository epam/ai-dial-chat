import { API, FileManagerColumnKey, MenuOptions } from '@/src/testData';
import { FileManagerColumnKey, MenuOptions } from '@/src/testData';
import { keys } from '@/src/ui/keyboard';
import {
  GridSelectors,
  IconSelectors,
  InputSelectors,
} from '@/src/ui/selectors';
import { Checkbox, Dropdown, Grid } from '@/src/ui/webElements';
import { FileUtil } from '@/src/utils';
import { Locator, Page } from '@playwright/test';
import { Locator } from '@playwright/test';

export const scrollingTimeout = 1000;

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

  public async gridDotsMenuByNameCell(name: string) {
    await this.goTop();
    const gridRowByNameCellLocator = await this.goToGridRowByNameCell(name);
    return gridRowByNameCellLocator
      .locator(GridSelectors.gridCell(FileManagerColumnKey.Actions))
      .locator(IconSelectors.dotsMenuIcon);
  }

  public async gridCheckboxByNameCell(name: string) {
    await this.goTop();
    const gridRowByNameCellLocator = await this.goToGridRowByNameCell(name);
    return new Checkbox(
      this.page,
      gridRowByNameCellLocator.locator(
        GridSelectors.gridCell(FileManagerColumnKey.Select),
      ),
    );
  }

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
    const dotsMenu = await this.gridDotsMenuByNameCell(currentName);
    await dotsMenu.click();
    await this.getRowDropdownMenu().selectItem(MenuOptions.rename);
    const nameWithoutExtension =
      FileUtil.getFilenameWithoutExtension(currentName);
    const input = this.getElementLocator().locator(
      InputSelectors.value(nameWithoutExtension),
    );
    await input.fill(newName);
    await this.click();
  }

  public async goToGridRowByNameCell(
    name: string,
    pageNumber = 1,
  ): Promise<Locator> {
    await this.loadingIndicator.waitForState({ state: 'hidden' });
    const gridRowByNameCellLocator = this.gridRowByNameCell(name);
    const scrollFullHeight = await this.gridViewPort
      .getElementLocator()
      .evaluate((p) => p.scrollHeight);
    const scrollBodyHeight = await this.gridBody
      .getElementLocator()
      .evaluate((p) => p.scrollHeight);
    const pagesCount = Math.round(scrollFullHeight / scrollBodyHeight);
    //try to scroll into grid record if it is visible on the page
    try {
      await gridRowByNameCellLocator.scrollIntoViewIfNeeded({
        timeout: scrollingTimeout,
      });
    } catch (e) {
      //scroll to the next page if the record is not visible
      if (pagesCount >= pageNumber) {
        const gridBodyBounding = await this.gridBody.getElementBoundingBox();
        await this.gridBody.hoverOver();
        await this.page.mouse.wheel(
          gridBodyBounding!.x,
          gridBodyBounding!.y + gridBodyBounding!.height + 1,
        );
        pageNumber += 1;
        return this.goToGridRowByNameCell(name, pageNumber);
      } else {
        throw new Error(`No row for the name: ${name} found`);
      }
    }
    return gridRowByNameCellLocator;
  }

  public async goTop() {
    const scrollTop = await this.gridViewPort
      .getElementLocator()
      .evaluate((p) => p.scrollTop);
    //check the scroll is not on the top of the grid
    if (scrollTop !== 0) {
      await this.gridBody.click({
        position: { x: 0, y: 0 },
      });
      await this.page.keyboard.press(keys.home);
      // wait until scrolling is finished
      // eslint-disable-next-line playwright/no-wait-for-timeout
      await this.page.waitForTimeout(scrollingTimeout);
    }
  }
}

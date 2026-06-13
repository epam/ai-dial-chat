import { API, FileManagerColumnKey, MenuOptions } from '@/src/testData';
import { Tags } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { ExpectedApiResponse } from '@/src/ui/pages';
import {
  EntityIconSelectors,
  GridSelectors,
  IconSelectors,
} from '@/src/ui/selectors';
import { Checkbox, Dropdown, Grid, Input } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export const scrollingTimeout = 1000;

export class FileManagerGrid extends Grid {
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

  public gridNameCellInput = new Input(
    this.page,
    this.gridRowColumn(FileManagerColumnKey.Name),
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

  public async gridFileIconByNameCell(name: string) {
    await this.goTop();
    const gridRowByNameCellLocator = await this.goToGridRowByNameCell(name);
    return gridRowByNameCellLocator.locator(EntityIconSelectors.fileIcon);
  }

  public async gridFileIconSvgByNameCell(name: string): Promise<Locator> {
    const iconLocator = await this.gridFileIconByNameCell(name);
    return iconLocator.locator(Tags.svg).first();
  }

  public getRenameRowFileIcon(): Locator {
    const renameRow = this.gridRows.getElementLocator().filter({
      has: this.page.locator(Tags.input),
    });
    return renameRow.locator(EntityIconSelectors.fileIcon);
  }

  public getRenameRowFileIconSvg(): Locator {
    return this.getRenameRowFileIcon().locator(Tags.svg).first();
  }

  public async gridSharedFileIconByNameCell(name: string) {
    const fileIcon = await this.gridFileIconByNameCell(name);
    return fileIcon.locator(IconSelectors.sharedEntityIcon);
  }

  public gridNameCell = (name: string) =>
    this.gridRowColumnByCellValue(FileManagerColumnKey.Name, name);

  public gridNameCellValue = (name: string) =>
    this.gridNameCell(name).locator(GridSelectors.gridCellValue);

  public async getNameColumnValues(): Promise<string[]> {
    return this.gridRowColumn(FileManagerColumnKey.Name)
      .locator(GridSelectors.gridCellValue)
      .allTextContents();
  }

  /**
   * Opens a folder by clicking on its name cell
   * @param folderName Name of the folder to open
   * @param waitForRequest Whether to wait for GET request to load folder contents (default: true)
   */
  public async openFolder(folderName: string, waitForRequest = true) {
    const gridRowByNameCellLocator =
      await this.goToGridRowByNameCell(folderName);
    if (waitForRequest) {
      const requestPromise = this.page.waitForResponse(
        (resp) =>
          resp.url().endsWith(API.folderFilesListingHost(folderName)) &&
          resp.request().method() === 'GET' &&
          resp.ok(),
      );
      await gridRowByNameCellLocator.click();
      await requestPromise;
    } else {
      await gridRowByNameCellLocator.click();
    }
  }

  public async setFolderName(folderName: string, waitForRequest = true) {
    await this.getRenameInput().fillInInput(folderName);
    await this.confirmNewFolderName(folderName, waitForRequest);
  }

  /**
   * Confirms the rename input value as-is by pressing Enter — used when the
   * default pre-filled name ("New folder N") is accepted without changes.
   */
  public async confirmNewFolderName(
    folderName?: string,
    waitForRequest = true,
  ) {
    if (waitForRequest) {
      const requestPromise = this.page.waitForResponse((resp) => {
        const urlMatches = folderName
          ? resp.url().endsWith(API.folderFilesListingHost(folderName))
          : resp.url().includes(API.folderFilesListingHost());
        return urlMatches && resp.request().method() === 'GET' && resp.ok();
      });
      await this.page.keyboard.press(keys.enter);
      await requestPromise;
    } else {
      await this.page.keyboard.press(keys.enter);
    }
  }

  public async renameFile(
    currentName: string,
    newName: string,
    { isHttpMethodTriggered = true }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    const dotsMenu = await this.gridDotsMenuByNameCell(currentName);
    await dotsMenu.click();
    await this.getRowDropdownMenu().selectItem(MenuOptions.rename);
    await this.getRenameInput().fillInInput(newName);
    if (isHttpMethodTriggered) {
      const hostsMap = new Map([
        [API.moveFilesHost, 'POST'],
        [API.folderFilesListingHost(), 'GET'],
      ]);
      const responses = [];
      for (const [host, method] of hostsMap) {
        const resp = this.page.waitForResponse(
          (response) =>
            response.url().includes(host) &&
            response.request().method() === method &&
            response.status() === 200,
        );
        responses.push(resp);
      }
      await this.click();
      for (const resp of responses) {
        await resp;
      }
    } else {
      await this.click();
    }
  }

  public getRowInputError(name?: string) {
    if (name) {
      return this.gridNameCellInput.alertIconByValue(name);
    }
    return this.gridNameCellInput.alertIcon.getElementLocator();
  }

  public getRowInputWarning(name?: string) {
    if (name) {
      return this.gridNameCellInput.warningIconByValue(name);
    }
    return this.gridNameCellInput.warningIcon.getElementLocator();
  }

  public getRenameInput() {
    return this.gridNameCellInput.inputField;
  }

  public async goToGridRowByNameCell(
    name: string,
    pageNumber = 1,
  ): Promise<Locator> {
    await this.loadingIndicator.waitForState({ state: 'hidden' });
    await this.gridRows.getNthElement(1).waitFor();
    const gridRowByNameCellLocator = this.gridRowByNameCell(name);
    const scrollFullHeight = await this.gridViewPort
      .getElementLocator()
      .evaluate((p) => p.scrollHeight);
    const scrollBodyHeight = await this.gridBody
      .getElementLocator()
      .evaluate((p) => p.scrollHeight);
    const pagesCount = Math.round(scrollFullHeight / scrollBodyHeight);
    // -- wait for ag grid to finish rendering and animation, etc
    await this.page.waitForTimeout(500);
    try {
      //try to scroll into grid record if it is visible on the page
      await gridRowByNameCellLocator.scrollIntoViewIfNeeded({
        timeout: scrollingTimeout,
      });
    } catch {
      //scroll to the next page if the record is not visible
      if (pagesCount >= pageNumber) {
        await this.gridBody.hoverOver();
        // mouse.wheel expects delta values in pixels: deltaX (horizontal), deltaY (vertical)
        await this.page.mouse.wheel(0, scrollBodyHeight);
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
    if (scrollTop !== 0) {
      await this.gridBody.click({
        position: { x: 0, y: 0 },
      });
      await this.page.keyboard.press(keys.home);
      // Wait until scroll actually reaches top
      await this.gridViewPort.getElementLocator().evaluate((el) => {
        return new Promise<void>((resolve) => {
          const checkScroll = () => {
            if (el.scrollTop === 0) {
              resolve();
            } else {
              requestAnimationFrame(checkScroll);
            }
          };
          checkScroll();
        });
      });
    }
  }

  public async saveRename() {
    const expectedApiResponses: ExpectedApiResponse[] = [
      { apiMethod: 'POST', urlPattern: API.moveFilesHost },
      { apiMethod: 'GET', urlPattern: API.folderFilesListingHost() },
    ];
    const responsePromises = expectedApiResponses.map((expected) =>
      this.page.waitForResponse((response) => {
        const methodMatch = expected.apiMethod
          ? response.request().method() === expected.apiMethod
          : true;
        const statusMatch = response.status() === (expected.status ?? 200);
        const urlPattern = expected.urlPattern;
        const responseUrl = response.url();
        const urlMatch = urlPattern
          ? urlPattern instanceof RegExp
            ? urlPattern.test(responseUrl)
            : responseUrl.includes(urlPattern)
          : true;
        return methodMatch && statusMatch && urlMatch;
      }),
    );
    await this.page.keyboard.press(keys.enter);
    await Promise.all(responsePromises);
  }
}

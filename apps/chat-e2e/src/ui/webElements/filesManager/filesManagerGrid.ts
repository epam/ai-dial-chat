import { FileManagerColumnKey, MenuOptions } from '@/src/testData';
import { keys } from '@/src/ui/keyboard';
import {
  GridSelectors,
  IconSelectors,
  InputSelectors,
} from '@/src/ui/selectors';
import { Checkbox, Dropdown, Grid } from '@/src/ui/webElements';
import { FileUtil } from '@/src/utils';
import { Locator } from '@playwright/test';

export class FilesManagerGrid extends Grid {
  public rowDropdownMenu!: Dropdown;

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
    try {
      await gridRowByNameCellLocator.scrollIntoViewIfNeeded({
        timeout: 1000,
      });
    } catch (e) {
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
    if (scrollTop !== 0) {
      await this.gridBody.click({
        position: { x: 0, y: 0 },
      });
      await this.page.keyboard.press(keys.home);
      // eslint-disable-next-line playwright/no-wait-for-timeout
      await this.page.waitForTimeout(1000);
    }
  }
}

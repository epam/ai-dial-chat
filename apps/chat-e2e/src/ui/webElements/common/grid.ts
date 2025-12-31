import { GridSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { RegexUtil } from '@/src/utils';
import { Locator, Page } from '@playwright/test';

export class Grid extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, GridSelectors.gridContainer, parentLocator);
  }

  public gridHeaderColumn = (columnId: string) =>
    this.getChildElementBySelector(GridSelectors.gridHeaderColumn(columnId));

  public gridRows = this.getChildElementBySelector(GridSelectors.gridRow());

  public loader = this.getChildElementBySelector(GridSelectors.gridLoader);

  public gridRowByCellValue = (columnId: string, value: string) =>
    this.gridRows.getElementLocator().filter({
      has: this.page.locator(GridSelectors.gridCell(columnId), {
        hasText: new RegExp(`^${RegexUtil.escapeRegexChars(value)}$`),
      }),
    });

  public gridRowColumnByCellValue = (columnId: string, value: string) =>
    this.gridRows
      .getChildElementBySelector(GridSelectors.gridCell(columnId))
      .getElementLocator()
      .filter({
        hasText: new RegExp(`^${RegexUtil.escapeRegexChars(value)}$`),
      });
}

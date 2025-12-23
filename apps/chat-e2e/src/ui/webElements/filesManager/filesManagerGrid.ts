import { FileManagerColumnKey } from '@/src/testData';
import { GridSelectors, IconSelectors } from '@/src/ui/selectors';
import { Checkbox, Dropdown, Grid } from '@/src/ui/webElements';

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
}

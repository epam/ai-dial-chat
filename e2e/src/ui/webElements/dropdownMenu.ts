import { Attributes, Tags } from '@/e2e/src/ui/domData';
import { Menu } from '@/e2e/src/ui/webElements/menu';

export class DropdownMenu extends Menu {
  public menuOptions = () =>
    this.getChildElementBySelector(
      `${Tags.button}:not([class*=' md:${Attributes.hidden}'])`,
    );

  public menuOption = (option: string) =>
    this.menuOptions().getElementLocatorByText(option);

  public getMenuOption(option: string) {
    return this.createElementFromLocator(
      this.menuOption(option).locator(Tags.span),
    );
  }
}

import { Attributes, Tags } from '@/src/ui/domData';
import { Menu } from '@/src/ui/webElements/menu';

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

import { Tags } from '@/src/ui/domData';
import { Menu } from '@/src/ui/webElements/menu';

export class DropdownCheckboxMenu extends Menu {
  public menuOptions = () => this.getChildElementBySelector(Tags.div);
  public menuOption = (option: string) =>
    this.menuOptions().getElementLocatorByText(option).locator(Tags.input);
}

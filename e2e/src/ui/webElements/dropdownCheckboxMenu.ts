import { Tags } from '@/e2e/src/ui/domData';
import { Menu } from '@/e2e/src/ui/webElements/menu';

export class DropdownCheckboxMenu extends Menu {
  public menuOptions = () => this.getChildElementBySelector(Tags.div);
  public menuOption = (option: string) =>
    this.menuOptions().getElementLocatorByText(option).locator(Tags.input);
}

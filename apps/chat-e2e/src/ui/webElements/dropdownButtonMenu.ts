import { Tags } from '@/src/ui/domData';
import { Menu } from '@/src/ui/webElements/menu';

export class DropdownButtonMenu extends Menu {
  public menuOptions = () => this.getChildElementBySelector(Tags.button);
  public menuOption = (option: string) =>
    this.menuOptions().getElementLocatorByText(option);
}

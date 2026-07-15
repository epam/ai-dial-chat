import { AttributeValues, Attributes, Tags } from '@/src/ui/domData';
import { Menu } from '@/src/ui/webElements/menu';

export class PublishVersionChecklistDropdown extends Menu {
  public menuOptions = () => this.getChildElementBySelector(Tags.li);
  public menuOption = (option: string) =>
    this.menuOptions().getElementLocatorByText(option);

  public getVersionCheckbox(version: string) {
    return this.menuOption(version).locator(
      `${Tags.input}[${Attributes.type}="${AttributeValues.checkbox}"]`,
    );
  }

  public getVersionCheckboxLabel(version: string) {
    return this.menuOption(version).locator(Tags.label);
  }
}

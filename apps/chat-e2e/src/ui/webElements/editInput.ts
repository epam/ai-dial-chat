import { Attributes } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { EditSelectors } from '@/src/ui/selectors/editSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class EditInput extends BaseElement {
  constructor(page: Page, parentLocator: Locator, selector: string) {
    super(page, `${selector} >> ${EditSelectors.editContainer}`, parentLocator);
  }

  public editInput = this.getChildElementBySelector(EditSelectors.editInput);

  public async editValue(newValue: string) {
    await this.page.keyboard.press(keys.ctrlPlusA);
    await this.editInput.fillInInput(newValue);
  }

  public async getEditInputValue() {
    return this.editInput.getAttribute(Attributes.value);
  }
}

import { keys } from '@/e2e/src/ui/keyboard';
import { ChatBarSelectors } from '@/e2e/src/ui/selectors';
import { BaseElement } from '@/e2e/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class Input extends BaseElement {
  constructor(page: Page, selector: string) {
    super(page, selector);
  }

  public actionButtons = new BaseElement(
    this.page,
    ChatBarSelectors.actionButton,
  );

  public async editValue(newValue: string) {
    await this.page.keyboard.press(keys.ctrlPlusA);
    await this.fillInInput(newValue);
  }

  public async clickTickButton() {
    await this.actionButtons.getNthElement(1).click();
  }

  public async clickCancelButton() {
    await this.actionButtons.getNthElement(2).click();
  }
}

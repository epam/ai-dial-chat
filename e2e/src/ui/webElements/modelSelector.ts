import { Tags } from '@/e2e/src/ui/domData';
import { ChatSelectors } from '@/e2e/src/ui/selectors';
import { BaseElement } from '@/e2e/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class ModelSelector extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.modelSelector);
  }

  private selectedModel = this.getChildElementBySelector(
    `${ChatSelectors.combobox}~${Tags.div}`,
  );
  private listOptions = this.getChildElementBySelector(
    ChatSelectors.listOptions,
  );
  private listOption = (option: string) =>
    this.listOptions.getElementLocatorByText(option);

  public async getSelectedModel() {
    return this.selectedModel.getElementContent();
  }

  public async getListOptions() {
    return this.listOptions.getElementsInnerContent();
  }

  public async selectModel(name: string) {
    await this.selectedModel.click();
    await this.listOptions.waitForState();
    await this.listOption(name).click();
  }
}

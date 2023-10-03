import { Attributes, Tags } from '@/e2e/src/ui/domData';
import { ChatSelectors } from '@/e2e/src/ui/selectors';
import { BaseElement } from '@/e2e/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class ModelSelector extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSelectors.modelSelector, parentLocator);
  }

  private modelInput = this.getChildElementBySelector(ChatSelectors.combobox);
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

  public async selectModel(name: string, isOpen = false) {
    if (!isOpen) {
      await this.click();
      await this.listOptions.getNthElement(1).waitFor();
    }
    await this.listOption(name).click();
  }

  public async getSelectorPlaceholder() {
    return this.modelInput.getAttribute(Attributes.placeholder);
  }
}

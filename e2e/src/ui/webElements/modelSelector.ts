import { Attributes, Tags } from '@/e2e/src/ui/domData';
import { ChatSelectors } from '@/e2e/src/ui/selectors';
import { BaseElement, Icons } from '@/e2e/src/ui/webElements/baseElement';
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

  public async getOptionsIconAttributes() {
    const allIcons: Icons[] = [];
    const optionsCount = await this.listOptions.getElementsCount();
    for (let i = 1; i <= optionsCount; i++) {
      const option = await this.listOptions.getNthElement(i);
      const customIconOption = await option.locator(ChatSelectors.chatIcon);
      if (await customIconOption.isVisible()) {
        const iconAttributes = await this.getElementIconAttributes(
          customIconOption,
        );
        allIcons.push(iconAttributes);
      } else {
        const defaultIconAttributes =
          await this.getElementDefaultIconAttributes(option);
        allIcons.push(defaultIconAttributes);
      }
    }
    return allIcons;
  }
}

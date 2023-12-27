import { Attributes, Tags } from '@/e2e/src/ui/domData';
import { ChatSelectors } from '@/e2e/src/ui/selectors';
import { BaseElement, EntityIcon } from '@/e2e/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class ModelSelector extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSelectors.modelSelector, parentLocator);
  }

  private modelInput = this.getChildElementBySelector(ChatSelectors.combobox);
  public listbox = this.getChildElementBySelector(ChatSelectors.listbox);
  private listOptions = this.listbox.getChildElementBySelector(
    ChatSelectors.listOptions,
  );
  private listOption = (option: string) =>
    this.listOptions.getElementLocatorByText(option);

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

  public async fillInput(text: string) {
    await this.modelInput.fillInInput(text);
  }

  public async getOptionsIcons() {
    const allIcons: EntityIcon[] = [];
    const optionsCount = await this.listOptions.getElementsCount();
    for (let i = 1; i <= optionsCount; i++) {
      const option = await this.listOptions.getNthElement(i);
      const optionName = await option.locator(Tags.desc).textContent();
      const optionIcon = await this.getElementIconHtml(option);
      allIcons.push({ entityName: optionName!, icon: optionIcon });
    }
    return allIcons;
  }
}

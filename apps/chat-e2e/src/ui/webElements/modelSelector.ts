import { Attributes, Styles, Tags } from '@/src/ui/domData';
import { ModelControlSelectors, SideBarSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class ModelSelector extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ModelControlSelectors.modelSelector, parentLocator);
  }

  private modelInput = this.getChildElementBySelector(
    ModelControlSelectors.combobox,
  );
  public listbox = this.getChildElementBySelector(
    ModelControlSelectors.listbox,
  );
  private listOptions = this.listbox.getChildElementBySelector(
    ModelControlSelectors.listOptions,
  );
  private listOption = (option: string) =>
    this.listOptions.getElementLocatorByText(option);

  public async getListOptions() {
    return this.listOptions.getElementsInnerContent();
  }

  public getOptionAdditionalIcon(option: string) {
    return this.listOption(option).locator(
      SideBarSelectors.arrowAdditionalIcon,
    );
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
    return this.getElementIcons(this.listOptions, Tags.desc);
  }

  public getOptionArrowIconColor(option: string) {
    return this.createElementFromLocator(
      this.getOptionAdditionalIcon(option).locator(Tags.svg),
    ).getComputedStyleProperty(Styles.color);
  }
}

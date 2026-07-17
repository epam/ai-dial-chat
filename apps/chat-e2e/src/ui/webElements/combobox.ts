import { Tags } from '@/src/ui/domData';
import { ComboboxSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/index';
import { RegexUtil } from '@/src/utils';
import { Locator, Page } from '@playwright/test';

export class Combobox extends BaseElement {
  // containerSelector defaults to the standard combobox; pass a custom one for
  // fields that override the container data-qa (e.g. QA2 attachment types).
  constructor(
    page: Page,
    parentLocator: Locator,
    containerSelector: string = ComboboxSelectors.comboboxContainer,
  ) {
    super(page, containerSelector, parentLocator);
  }

  public comboboxInput = this.getChildElementBySelector(Tags.input);
  public selectedPills = this.getChildElementBySelector(
    ComboboxSelectors.selectedPills,
  );

  public getSelectedPill(value: string): BaseElement {
    const escapedType = RegexUtil.escapeRegexChars(value);
    const exactMatchRegex = new RegExp(`^${escapedType}$`);
    return this.createElementFromLocator(
      this.selectedPills
        .getElementLocator()
        .filter({ hasText: exactMatchRegex }),
    );
  }

  public getSelectedPillRemoveIcon(value: string): BaseElement {
    return this.getSelectedPill(value).getChildElementBySelector(
      ComboboxSelectors.unselectPillButton(value),
    );
  }

  public async getSelectedPillValues(
    waitForAtLeastOnePill?: boolean,
  ): Promise<string[]> {
    if (waitForAtLeastOnePill) {
      await this.selectedPills.getNthElement(1).waitFor();
    }
    const pillsCount = await this.selectedPills.getElementsCount();
    const values: string[] = [];
    for (let i = 1; i <= pillsCount; i++) {
      const pillTextContent = await this.selectedPills
        .getNthElement(i)
        .textContent();
      if (pillTextContent) {
        values.push(pillTextContent.trim());
      }
    }
    return values;
  }

  public async removeSelectedPillValue(value: string) {
    const removeIcon = this.getSelectedPillRemoveIcon(value);
    await removeIcon.click();
  }
}

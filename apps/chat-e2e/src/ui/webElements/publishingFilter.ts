import { IconSelectors, PublishingFilterSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { DropdownButtonMenu } from '@/src/ui/webElements/dropdownButtonMenu';
import { Locator, Page } from '@playwright/test';

export class PublishingFilter extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, PublishingFilterSelectors.filterContainer, parentLocator);
  }

  public filterTargetDropdownMenu!: DropdownButtonMenu;
  public filterFunctionDropdownMenu!: DropdownButtonMenu;

  getFilterTargetDropdownMenu(): DropdownButtonMenu {
    if (!this.filterTargetDropdownMenu) {
      this.filterTargetDropdownMenu = new DropdownButtonMenu(this.page);
    }
    return this.filterTargetDropdownMenu;
  }

  getFilterFunctionDropdownMenu(): DropdownButtonMenu {
    if (!this.filterFunctionDropdownMenu) {
      this.filterFunctionDropdownMenu = new DropdownButtonMenu(this.page);
    }
    return this.filterFunctionDropdownMenu;
  }

  public filterTarget = this.getChildElementBySelector(
    PublishingFilterSelectors.filterTarget,
  );
  public filterFunction = this.getChildElementBySelector(
    PublishingFilterSelectors.filterFunction,
  );
  public filterValuesContainer = this.getChildElementBySelector(
    PublishingFilterSelectors.filterValuesContainer,
  );
  public filterValueInput =
    this.filterValuesContainer.getChildElementBySelector(
      PublishingFilterSelectors.filterValueInput,
    );
  public filterValueSuggestion = (suggestedValue: string) =>
    this.filterValuesContainer
      .getChildElementBySelector(
        PublishingFilterSelectors.filterValueSuggestion,
      )
      .getElementLocatorByText(suggestedValue);
  public filterPills = this.filterValuesContainer.getChildElementBySelector(
    PublishingFilterSelectors.filterPill,
  );
  public filterPill = (value: string) =>
    this.filterPills.getElementLocatorByText(new RegExp(`^${value}$`));
  public saveFilterButton = this.getChildElementBySelector(
    PublishingFilterSelectors.saveFilterButton,
  );
  public cancelFilterButton = this.getChildElementBySelector(
    IconSelectors.cancelIcon,
  );

  public async setFilterValue(value: string) {
    await this.filterValueInput.fillInInput(value);
    const suggestion = this.filterValueSuggestion(value);
    await suggestion.waitFor();
    await suggestion.click();
    await suggestion.waitFor({ state: 'hidden' });
    await this.filterPill(value).waitFor();
  }
}

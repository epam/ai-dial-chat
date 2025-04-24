import { API } from '@/src/testData';
import { Attributes, Tags } from '@/src/ui/domData';
import {
  AddApplicationGeneralInfoFormSelector,
  IconSelectors,
} from '@/src/ui/selectors';
import { AppEditorForm } from '@/src/ui/webElements/appEditor/appEditorForm';
import { BaseElement } from '@/src/ui/webElements/baseElement';
// Import BaseElement
import { Locator, Page } from '@playwright/test';

export class AppEditorGeneralForm extends AppEditorForm {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      AddApplicationGeneralInfoFormSelector.appGeneralFormContainer,
      parentLocator,
    );
  }

  // Existing elements
  public name = this.getChildElementBySelector(
    AddApplicationGeneralInfoFormSelector.name,
  );
  public version = this.getChildElementBySelector(
    AddApplicationGeneralInfoFormSelector.version,
  );
  public description = this.getChildElementBySelector(
    AddApplicationGeneralInfoFormSelector.description,
  );
  public nextButton = this.getChildElementBySelector(
    AddApplicationGeneralInfoFormSelector.nextButton,
  );

  // Updated/New elements for Topics dropdown
  public topicsDropdownContainer = this.getChildElementBySelector(
    AddApplicationGeneralInfoFormSelector.topicsDropdown, // Use the ID selector
  );

  // Assuming the container itself or a specific child acts as the toggle
  public topicsDropdownToggle = this.topicsDropdownContainer; // Or a more specific selector if needed

  public topicsDropdownMenuElement =
    this.topicsDropdownContainer.getChildElementBySelector(
      '[class*="-menu"]', // Selector for the opened menu container
    );

  public selectedTopicPills =
    this.topicsDropdownContainer.getChildElementBySelector(
      '[class*="-multiValue"]', // Selector for the selected topic pills
    );

  public clearAllTopicsButton =
    this.topicsDropdownContainer.getChildElementBySelector(
      '[data-qa="clear-dropdown-selection"]', // Selector for the main clear button
    );

  // Method to get all available topic options from the dropdown
  public async getAllTopicsOptions(): Promise<string[]> {
    const optionsLocator =
      this.topicsDropdownMenuElement.getChildElementBySelector(
        '[role="option"]',
      );
    return optionsLocator.getElementLocator().allInnerTexts();
  }

  // Method to select a topic option by its text
  public async selectTopicOption(topicName: string) {
    const optionLocator = this.topicsDropdownMenuElement
      .getChildElementBySelector('[role="option"]')
      .getElementLocator()
      .filter({ hasText: topicName });
    await optionLocator.click();
  }

  // Method to get selected topics text
  public async getSelectedTopics(): Promise<string[]> {
    const pills = await this.selectedTopicPills.getElementsCount();
    const topics: string[] = [];
    if (pills > 0) {
      for (let i = 1; i <= pills; i++) {
        // Selector for the text part within the pill
        const topicText = await this.selectedTopicPills
          .getNthElement(i)
          .locator('div:first-child') // Assuming the text is in the first div
          .textContent();
        if (topicText) {
          topics.push(topicText);
        }
      }
    }
    return topics;
  }

  // Method to delete a specific selected topic pill
  public async deleteSelectedTopic(topicName: string) {
    const topicPill = this.selectedTopicPills
      .getElementLocator()
      .filter({ hasText: topicName });
    // Selector for the 'x' icon within the pill, using aria-label
    const removeIcon = topicPill.locator(
      `[role="button"][aria-label="Remove ${topicName}"]`,
    );
    await removeIcon.click();
  }

  // Method to clear all selected topics
  public async clearAllTopics() {
    await this.clearAllTopicsButton.click();
  }

  // Existing methods
  public async fillInAppFields(options: {
    name?: string;
    version?: string;
    description?: string;
  }) {
    if (options.name) {
      await this.name.fillInInput(options.name);
    }
    if (options.version) {
      await this.version.fillInInput(options.version);
    }
    if (options.description) {
      await this.description.fillInInput(options.description);
    }
  }

  public async goNext() {
    const responses = [];
    const hostsArray = [
      API.applicationCreateHost,
      API.installedDeploymentsHost(),
    ];
    for (const host of hostsArray) {
      const resp = this.page.waitForResponse(
        (response) =>
          response.url().includes(host) &&
          (response.request().method() === 'POST' ||
            response.request().method() === 'PUT') &&
          response.status() === 200,
      );
      responses.push(resp);
    }
    await this.nextButton.click();
    for (const resp of responses) {
      await resp;
    }
  }
}

import { API, Attachment } from '@/src/testData';
import { Tags } from '@/src/ui/domData';
import { AddApplicationGeneralInfoFormSelector } from '@/src/ui/selectors';
import { AppEditorForm } from '@/src/ui/webElements/appEditor/appEditorForm';
import { RegexUtil } from '@/src/utils';
import { Locator, Page } from '@playwright/test';

export class AppEditorGeneralForm extends AppEditorForm {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      AddApplicationGeneralInfoFormSelector.appGeneralFormContainer,
      parentLocator,
    );
  }

  public name = this.getChildElementBySelector(
    AddApplicationGeneralInfoFormSelector.name,
  );
  public version = this.getChildElementBySelector(
    AddApplicationGeneralInfoFormSelector.version,
  );
  public description = this.getChildElementBySelector(
    AddApplicationGeneralInfoFormSelector.descriptionInput,
  );
  public descriptionLabel = this.getChildElementBySelector(
    AddApplicationGeneralInfoFormSelector.descriptionLabel,
  );
  public descriptionHintIcon = this.descriptionLabel.getChildElementBySelector(
    Tags.svg,
  );
  public nextButton = this.getChildElementBySelector(
    AddApplicationGeneralInfoFormSelector.nextButton,
  );
  public topicsDropdownContainer = this.getChildElementBySelector(
    AddApplicationGeneralInfoFormSelector.topicsDropdownContainer,
  );
  public topicsDropdownToggle =
    this.topicsDropdownContainer.getChildElementBySelector(
      AddApplicationGeneralInfoFormSelector.topicsDropdownToggle,
    );

  public selectedTopicPills =
    this.topicsDropdownContainer.getChildElementBySelector(
      AddApplicationGeneralInfoFormSelector.selectedTopicPills,
    );
  public clearAllTopicsButton =
    this.topicsDropdownContainer.getChildElementBySelector(
      AddApplicationGeneralInfoFormSelector.clearAllTopicsButton,
    );
  public iconInputElement = this.getChildElementBySelector(
    AddApplicationGeneralInfoFormSelector.iconField,
  );

  public addIconButton = this.iconInputElement.getChildButtonElement();

  // Method to get selected topics text
  public async getSelectedTopics(): Promise<string[]> {
    const pillsCount = await this.selectedTopicPills.getElementsCount();
    const topics: string[] = [];
    for (let i = 1; i <= pillsCount; i++) {
      const topicText = await this.selectedTopicPills
        .getNthElement(i)
        .textContent();
      if (topicText) {
        topics.push(topicText);
      }
    }
    return topics;
  }

  // Method to delete a specific selected topic pill
  public async deleteSelectedTopic(topicName: string) {
    const escapedTopicName = RegexUtil.escapeRegexChars(topicName);
    const exactMatchRegex = new RegExp(`^${escapedTopicName}$`);
    const topicPill = this.selectedTopicPills
      .getElementLocator()
      .filter({ hasText: exactMatchRegex });
    const removeIcon = topicPill.locator(
      AddApplicationGeneralInfoFormSelector.selectedTopicPillRemoveIcon(
        topicName,
      ),
    );
    await removeIcon.click();
  }

  public async clearAllTopics() {
    await this.clearAllTopicsButton.click();
  }

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

  public async goNext(
    options: { waitForResponses?: boolean } = { waitForResponses: true }, // Default to waiting
  ) {
    const responses = [];
    if (options.waitForResponses) {
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
    }

    await this.nextButton.click(); // Always click the button

    if (options.waitForResponses) {
      for (const resp of responses) {
        await resp; // Wait for responses only if requested
      }
    }
  }

  public async uploadIcon(iconFilename: string) {
    await this.addIconButton.click();
    // Set the file on the (potentially hidden) input element
    await this.iconInputElement.setElementInputFiles(
      Attachment.attachmentPath,
      iconFilename,
    );
  }
}

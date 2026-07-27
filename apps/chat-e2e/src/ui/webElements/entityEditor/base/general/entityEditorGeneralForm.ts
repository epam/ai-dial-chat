import { Attachment } from '@/src/testData';
import { Tags } from '@/src/ui/domData';
import {
  AddEntityGeneralInfoFormSelector,
  IconSelectors,
} from '@/src/ui/selectors';
import { EntityEditorForm } from '@/src/ui/webElements';
import { RegexUtil } from '@/src/utils';
import { Locator, Page } from '@playwright/test';

export class EntityEditorGeneralForm extends EntityEditorForm {
  constructor(page: Page, parentLocator?: Locator) {
    super(
      page,
      AddEntityGeneralInfoFormSelector.entityGeneralFormContainer,
      parentLocator,
    );
  }

  public name = this.getChildElementBySelector(
    AddEntityGeneralInfoFormSelector.name,
  );
  public version = this.getChildElementBySelector(
    AddEntityGeneralInfoFormSelector.version,
  );
  public description = this.getChildElementBySelector(
    AddEntityGeneralInfoFormSelector.descriptionInput,
  );
  public descriptionLabel = this.getChildElementBySelector(
    AddEntityGeneralInfoFormSelector.descriptionLabel,
  );
  public descriptionHintIcon = this.descriptionLabel.getChildElementBySelector(
    Tags.svg,
  );
  public nextButton = this.getChildElementBySelector(
    AddEntityGeneralInfoFormSelector.nextButton,
  );
  public topicsDropdownContainer = this.getChildElementBySelector(
    AddEntityGeneralInfoFormSelector.topicsDropdownContainer,
  );
  public topicsDropdownToggle =
    this.topicsDropdownContainer.getChildElementBySelector(
      IconSelectors.chevronDownIcon,
    );
  public selectedTopicPills =
    this.topicsDropdownContainer.getChildElementBySelector(
      AddEntityGeneralInfoFormSelector.selectedTopicPills,
    );
  public clearAllTopicsButton =
    this.topicsDropdownContainer.getChildElementBySelector(
      AddEntityGeneralInfoFormSelector.clearAllTopicsButton,
    );
  public iconField = this.getChildElementBySelector(
    AddEntityGeneralInfoFormSelector.icon,
  );
  public addIconButton = this.getChildElementBySelector(
    AddEntityGeneralInfoFormSelector.addIcon,
  );
  public changeIcon = this.getChildElementBySelector(
    AddEntityGeneralInfoFormSelector.changeIcon,
  );

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
      AddEntityGeneralInfoFormSelector.selectedTopicPillRemoveIcon(topicName),
    );
    await removeIcon.click();
  }

  public async clearAllTopics() {
    await this.clearAllTopicsButton.click();
  }

  public async fillInEntityFields(options: {
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

  public async goNext(options?: { hostsArray?: string[] }) {
    const responses = [];
    if (options?.hostsArray) {
      for (const host of options.hostsArray) {
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

    if (options?.hostsArray) {
      for (const resp of responses) {
        await resp; // Wait for responses only if requested
      }
    }
  }

  public async uploadIcon(iconFilename: string) {
    await this.addIconButton.click();
    // Set the file on the (potentially hidden) input element
    await this.addIconButton.setElementInputFiles(
      Attachment.attachmentPath,
      iconFilename,
    );
  }
}

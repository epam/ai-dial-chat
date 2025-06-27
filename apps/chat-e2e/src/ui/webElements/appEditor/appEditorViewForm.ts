import { ExampleURLs } from '@/src/testData';
import { Tags } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { AddApplicationAppSettingsFormSelector } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { AppEditorForm } from '@/src/ui/webElements/appEditor/appEditorForm';
import { RegexUtil } from '@/src/utils';
import { Locator, Page } from '@playwright/test';

export class AppEditorViewForm extends AppEditorForm {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      AddApplicationAppSettingsFormSelector.appViewFormContainer,
      parentLocator,
    );
  }

  public chatCompletionUrl = this.getChildElementBySelector(
    AddApplicationAppSettingsFormSelector.chatCompletionUrl,
  );
  public featuresLabel = this.getChildElementBySelector(
    AddApplicationAppSettingsFormSelector.featuresLabel,
  );
  public attachmentsTypesLabel = this.getChildElementBySelector(
    AddApplicationAppSettingsFormSelector.attachmentsTypesLabel,
  );
  public attachmentTypesContainer = this.getChildElementBySelector(
    AddApplicationAppSettingsFormSelector.attachmentTypesContainer,
  );

  public attachmentTypesInput =
    this.attachmentTypesContainer.getChildElementBySelector(Tags.input);

  public selectedAttachmentTypePills =
    this.attachmentTypesContainer.getChildElementBySelector(
      AddApplicationAppSettingsFormSelector.selectedAttachmentTypePills,
    );

  public getSelectedAttachmentTypePill(type: string): BaseElement {
    const escapedType = RegexUtil.escapeRegexChars(type);
    const exactMatchRegex = new RegExp(`^${escapedType}$`);
    return this.createElementFromLocator(
      this.selectedAttachmentTypePills
        .getElementLocator()
        .filter({ hasText: exactMatchRegex }),
    );
  }

  public getSelectedAttachmentTypePillRemoveIcon(type: string): BaseElement {
    return this.getSelectedAttachmentTypePill(type).getChildElementBySelector(
      AddApplicationAppSettingsFormSelector.unselectAttachmentTypePillButton(
        type,
      ),
    );
  }

  public featuresDataHintIcon = this.featuresLabel.getChildElementBySelector(
    Tags.svg,
  );
  public attachmentTypesHintIcon =
    this.attachmentsTypesLabel.getChildElementBySelector(Tags.svg);

  public maxAttachmentsInput = this.getChildElementBySelector(
    AddApplicationAppSettingsFormSelector.maxAttachmentNumberField,
  );

  public async fillInAppFields(options?: {
    chatCompletionUrl?: string;
    attachmentTypes?: string[];
    maxAttachments?: string;
  }) {
    if (options?.chatCompletionUrl) {
      await this.chatCompletionUrl.fillInInput(options.chatCompletionUrl);
    } else {
      await this.chatCompletionUrl.fillInInput(ExampleURLs.chatCompletionURL);
    }
    if (options?.attachmentTypes && options.attachmentTypes.length > 0) {
      for (const type of options.attachmentTypes) {
        await this.attachmentTypesInput.fillInInput(type);
        await this.page.keyboard.press(keys.enter);
      }
    }
    if (options?.maxAttachments !== undefined) {
      await this.maxAttachmentsInput.typeInInput(options.maxAttachments);
    }
  }

  public async getSelectedAttachmentTypes(): Promise<string[]> {
    const pillsCount =
      await this.selectedAttachmentTypePills.getElementsCount();
    const types: string[] = [];
    for (let i = 1; i <= pillsCount; i++) {
      const pillTextContent = await this.selectedAttachmentTypePills
        .getNthElement(i)
        .textContent();
      if (pillTextContent) {
        types.push(pillTextContent.trim());
      }
    }
    return types;
  }

  public async removeSelectedAttachmentType(type: string) {
    const removeIcon = this.getSelectedAttachmentTypePillRemoveIcon(type);
    await removeIcon.click();
  }
}

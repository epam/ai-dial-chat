import { ExampleURLs } from '@/src/testData';
import { Tags } from '@/src/ui/domData';
import { AddApplicationAppSettingsFormSelector } from '@/src/ui/selectors';
import { AppEditorForm } from '@/src/ui/webElements/appEditor/appEditorForm';
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

  public featuresDataHintIcon = this.featuresLabel.getChildElementBySelector(
    Tags.svg,
  );
  public attachmentTypesHintIcon =
    this.attachmentsTypesLabel.getChildElementBySelector(Tags.svg);

  public async fillInAppFields(options?: { chatCompletionUrl?: string }) {
    const chatCompletionUrl =
      options?.chatCompletionUrl ?? ExampleURLs.chatCompletionURL;
    await this.chatCompletionUrl.fillInInput(chatCompletionUrl);
  }
}

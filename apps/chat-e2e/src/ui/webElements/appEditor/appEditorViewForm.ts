import { ExampleURLs } from '@/src/testData';
import { AddApplicationFormSelector } from '@/src/ui/selectors';
import { AppEditorForm } from '@/src/ui/webElements/appEditor/appEditorForm';
import { Locator, Page } from '@playwright/test';

export class AppEditorViewForm extends AppEditorForm {
  constructor(page: Page, parentLocator: Locator) {
    super(page, AddApplicationFormSelector.appViewFormContainer, parentLocator);
  }

  public chatCompletionUrl = this.getChildElementBySelector(
    AddApplicationFormSelector.chatCompletionUrl,
  );

  public async fillInAppFields(options?: { chatCompletionUrl?: string }) {
    const chatCompletionUrl =
      options?.chatCompletionUrl ?? ExampleURLs.chatCompletionURL;
    await this.chatCompletionUrl.fillInInput(chatCompletionUrl);
  }
}

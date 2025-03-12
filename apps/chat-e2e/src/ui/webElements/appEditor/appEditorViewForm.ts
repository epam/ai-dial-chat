import { AddApplicationFormSelector } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class AppEditorViewForm extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, AddApplicationFormSelector.appViewFormContainer, parentLocator);
  }

  public chatCompletionUrl = this.getChildElementBySelector(
    AddApplicationFormSelector.chatCompletionUrl,
  );

  public async fillInAppFields(options?: { chatCompletionUrl?: string }) {
    const chatCompletionUrl =
      options?.chatCompletionUrl ?? 'http://test.example.com';
    await this.chatCompletionUrl.fillInInput(chatCompletionUrl);
  }
}

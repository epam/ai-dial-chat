import { ChatSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class InputAttachments extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSelectors.inputAttachmentsContainer, parentLocator);
  }

  public inputAttachment = (name: string) =>
    this.getChildElementBySelector(
      ChatSelectors.inputAttachment,
    ).getElementLocatorByText(name);
  public inputAttachmentLoadingIndicator = (name: string) =>
    this.inputAttachment(name).locator(
      ChatSelectors.inputAttachmentLoadingIndicator,
    );
}

import { Tags } from '@/src/ui/domData';
import { ErrorLabelSelectors, MessageInputSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class InputAttachments extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, MessageInputSelectors.inputAttachmentsContainer, parentLocator);
  }

  public inputAttachments = this.getChildElementBySelector(
    MessageInputSelectors.inputAttachment,
  );

  public inputAttachment = (name: string) =>
    this.inputAttachments.getElementLocatorByText(name);

  public inputAttachmentLoadingIndicator = (name: string) =>
    this.inputAttachment(name).locator(
      MessageInputSelectors.inputAttachmentLoadingIndicator,
    );

  public inputAttachmentName = (name: string) =>
    this.createElementFromLocator(
      this.inputAttachment(name).locator(
        MessageInputSelectors.inputAttachmentName,
      ),
    );

  public inputAttachmentErrorIcon = (name: string) =>
    this.inputAttachment(name).locator(
      `${Tags.svg}${ErrorLabelSelectors.fieldError}`,
    );

  public inputAttachmentLoadingRetry = (name: string) =>
    this.inputAttachment(name).locator(
      MessageInputSelectors.inputAttachmentLoadingRetry,
    );

  public removeInputAttachmentIcon = (name: string) =>
    this.createElementFromLocator(
      this.inputAttachment(name).locator(
        MessageInputSelectors.removeInputAttachment,
      ),
    );
}

import { Tags } from '@/src/ui/domData';
import { ErrorLabelSelectors, MessageInputSelectors } from '@/src/ui/selectors';
import { FileSelectors } from '@/src/ui/selectors/fileSelectors';
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
    this.inputAttachment(name).locator(FileSelectors.loadingIndicator);

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
    this.inputAttachment(name).locator(FileSelectors.loadingRetry);

  public removeInputAttachmentIcon = (name: string) =>
    this.createElementFromLocator(
      this.inputAttachment(name).locator(FileSelectors.remove),
    );

  public async retryLoading(
    name: string,
    options?: { isHttpMethodTriggered: boolean },
  ) {
    if (options?.isHttpMethodTriggered) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'POST' && resp.status() === 200,
      );
      await this.inputAttachmentLoadingRetry(name).click();
      return respPromise;
    }
    await this.inputAttachmentLoadingRetry(name).click();
  }
}

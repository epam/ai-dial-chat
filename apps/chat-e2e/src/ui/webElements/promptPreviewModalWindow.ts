import {
  ShareByLinkResponseModel,
  ShareRequestModel,
} from '@/chat/types/share';
import { isApiStorageType } from '@/src/hooks/global-setup';
import { API } from '@/src/testData';
import { Tags } from '@/src/ui/domData';
import { IconSelectors } from '@/src/ui/selectors';
import { PromptPreviewModal } from '@/src/ui/selectors/dialogSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class PromptPreviewModalWindow extends BaseElement {
  constructor(page: Page) {
    super(page, PromptPreviewModal.promptPreviewModal);
  }

  public modalTitle = this.getChildElementBySelector(
    PromptPreviewModal.promptPreviewModalTitle,
  );
  public promptDescription = this.getChildElementBySelector(
    PromptPreviewModal.promptPreviewDescription,
  );
  public promptName = this.getChildElementBySelector(
    PromptPreviewModal.promptPreviewName,
  );
  public promptContent = this.getChildElementBySelector(
    PromptPreviewModal.promptPreviewContent,
  );
  public promptContentVar = (variable: string) =>
    this.promptContent
      .getChildElementBySelector(Tags.span)
      .getElementLocatorByText(variable);
  public promptExportButton = this.getChildElementBySelector(
    PromptPreviewModal.promptExportButton,
  );
  public promptExportButtonIcon =
    this.promptExportButton.getChildElementBySelector(Tags.svg);
  public promptMoveToButton = this.getChildElementBySelector(
    PromptPreviewModal.movePromptButton,
  );
  public promptShareButton = this.getChildElementBySelector(
    PromptPreviewModal.sharePromptButton,
  );
  public promptPublishButton = this.getChildElementBySelector(
    PromptPreviewModal.publishPromptButton,
  );
  public promptUnpublishButton = this.getChildElementBySelector(
    PromptPreviewModal.unpublishPromptButton,
  );
  public editPromptButton = this.getChildElementBySelector(
    PromptPreviewModal.editPromptButton,
  );
  public usePromptButton = this.getChildElementBySelector(
    PromptPreviewModal.usePromptButton,
  );
  public promptInfoButton = this.getChildElementBySelector(
    PromptPreviewModal.promptInfoButton,
  );
  public promptDeleteButton = this.getChildElementBySelector(
    PromptPreviewModal.promptDeleteButton,
  );
  public promptDeleteButtonIcon =
    this.promptDeleteButton.getChildElementBySelector(Tags.svg);
  public promptDuplicateButton = this.getChildElementBySelector(
    PromptPreviewModal.promptDuplicateButton,
  );
  public version = this.getChildElementBySelector(
    PromptPreviewModal.promptPreviewVersion,
  );
  public notFound = this.getChildElementBySelector(
    PromptPreviewModal.promptNotFound,
  );
  public closeButton = this.getChildElementBySelector(IconSelectors.cancelIcon);

  public async openPromptInfo(options?: { isHttpMethodTriggered?: boolean }) {
    if (options?.isHttpMethodTriggered) {
      const respPromise = this.page.waitForResponse(
        (r) => r.request().method() === 'GET' && r.status() === 200,
      );
      await this.promptInfoButton.click();
      return respPromise;
    }
    await this.promptInfoButton.click();
  }

  public async duplicatePrompt({
    isHttpMethodTriggered = true,
  }: { isHttpMethodTriggered?: boolean } = {}) {
    await this.waitForState();
    if (isApiStorageType && isHttpMethodTriggered) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'POST',
      );
      await this.promptDuplicateButton.click();
      return respPromise;
    }
    await this.promptDuplicateButton.click();
  }

  public async sharePrompt() {
    const responsePromise = this.page.waitForResponse(
      (resp) =>
        resp.request().method() === 'POST' &&
        resp.url().includes(API.shareEntityHost) &&
        resp.status() === 200,
    );
    await this.promptShareButton.click();
    const response = await responsePromise;
    const responseText = await response.text();
    const request = await response.request().postDataJSON();
    return {
      request: request as ShareRequestModel,
      response: JSON.parse(responseText) as ShareByLinkResponseModel,
    };
  }
}

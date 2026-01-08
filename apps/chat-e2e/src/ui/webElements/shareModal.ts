import { BaseElement } from './baseElement';

import { AttributeValues, Tags } from '@/src/ui/domData';
import { ChatSelectors, ShareModalSelectors } from '@/src/ui/selectors';
import { Button } from '@/src/ui/webElements/common/button';
import { Locator, Page } from '@playwright/test';

export class ShareModal extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(page, ShareModalSelectors.modalContainer, parentLocator);
  }

  public closeButton = new Button(
    this.page,
    AttributeValues.close,
    this.rootLocator,
  );
  public copyLinkButton = new Button(
    this.page,
    AttributeValues.copyLink,
    this.rootLocator,
  );
  public copyLinkIcon = this.copyLinkButton.getChildElementBySelector(Tags.svg);
  public shareLinkInput = this.getChildElementBySelector(
    ShareModalSelectors.shareLink,
  );
  public entityName = this.getChildElementBySelector(
    ShareModalSelectors.entityName,
  );
  public shareQrCodeContainer = this.getChildElementBySelector(
    ShareModalSelectors.qrCode,
  );
  public shareQrCodeImage = this.shareQrCodeContainer.getChildElementBySelector(
    Tags.svg,
  );

  public linkInputLoader = this.getChildElementBySelector(
    ChatSelectors.entitySpinner,
  );

  public shareText = this.getChildElementBySelector(
    ShareModalSelectors.shareText,
  );

  public removeAccessBtn = this.getChildElementBySelector(
    ShareModalSelectors.removeAccessBtn,
  );

  public notSharedEntityLabel = this.getChildElementBySelector(
    ShareModalSelectors.notSharedEntityLabel,
  );
}

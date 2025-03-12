import { BaseElement } from './baseElement';

import { Tags } from '@/src/ui/domData';
import { ChatSelectors, ShareModalSelectors } from '@/src/ui/selectors';
import { IconSelectors } from '@/src/ui/selectors/iconSelectors';
import { Locator, Page } from '@playwright/test';

export class ShareModal extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(page, ShareModalSelectors.modalContainer, parentLocator);
  }

  public closeButton = this.getChildElementBySelector(IconSelectors.cancelIcon);
  public copyLinkButton = this.getChildElementBySelector(
    `${ShareModalSelectors.copyLink} > ${Tags.svg}`,
  );
  public shareLinkInput = this.getChildElementBySelector(
    ShareModalSelectors.shareLink,
  );
  public entityName = this.getChildElementBySelector(
    ShareModalSelectors.entityName,
  );

  public linkInputLoader = this.getChildElementBySelector(
    ChatSelectors.messageSpinner,
  );

  public shareText = this.getChildElementBySelector(
    ShareModalSelectors.shareText,
  );

  public async getShareTextContent() {
    const allContent = await this.shareText.getElementsInnerContent();
    return allContent.join(' ').replaceAll(/\u00a0/g, ' ');
  }
}

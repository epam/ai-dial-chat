import { BaseElement } from './baseElement';

import { Tags } from '@/src/ui/domData';
import { ChatSelectors } from '@/src/ui/selectors';
import { IconSelectors } from '@/src/ui/selectors/iconSelectors';
import { ShareModalSelectors } from '@/src/ui/selectors/shareModalSelectors';
import { Page } from '@playwright/test';

export class ShareModal extends BaseElement {
  constructor(page: Page) {
    super(page, ShareModalSelectors.modalContainer);
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

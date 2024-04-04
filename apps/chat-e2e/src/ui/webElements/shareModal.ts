import { BaseElement } from './baseElement';

import { Tags } from '@/src/ui/domData';
import { ChatSelectors } from '@/src/ui/selectors';
import { IconSelectors } from '@/src/ui/selectors/iconSelectors';
import { ModalSelectors } from '@/src/ui/selectors/modalSelectors';
import { Page } from '@playwright/test';

export class ShareModal extends BaseElement {
  constructor(page: Page) {
    super(page, ModalSelectors.modalContainer);
  }

  public closeButton = this.getChildElementBySelector(IconSelectors.cancelIcon);
  public copyLinkButton = this.getChildElementBySelector(
    `${ModalSelectors.copyLink} > ${Tags.svg}`,
  );
  public shareLinkInput = this.getChildElementBySelector(
    ModalSelectors.shareLink,
  );
  public entityName = this.getChildElementBySelector(ModalSelectors.entityName);

  public linkInputLoader = this.getChildElementBySelector(
    ChatSelectors.messageSpinner,
  );

  public shareText = this.getChildElementBySelector(ModalSelectors.shareText);

  public async getShareTextContent() {
    const allContent = await this.shareText.getElementsInnerContent();
    return allContent.join(' ').replaceAll(/\u00a0/g, ' ');
  }
}

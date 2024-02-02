import { BaseElement } from './baseElement';

import { Tags } from '@/src/ui/domData';
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
  public chatName = this.getChildElementBySelector(ModalSelectors.chatName);
}

import { Tags } from '@/e2e/src/ui/domData';
import { HeaderSelectors, IconSelectors } from '@/e2e/src/ui/selectors';
import { BaseElement } from '@/e2e/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class Banner extends BaseElement {
  constructor(page: Page) {
    super(page, HeaderSelectors.banner);
  }

  public bannerMessage = this.getChildElementBySelector(Tags.span);
  public bannerMessageLink = this.bannerMessage.getChildElementBySelector(
    Tags.a,
  );
  public bannerIcon = this.getElementIconHtml(this.rootLocator);
  public closeButton = this.getChildElementBySelector(IconSelectors.cancelIcon);
}

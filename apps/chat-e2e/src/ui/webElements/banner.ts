import { Tags } from '@/src/ui/domData';
import { HeaderSelectors, IconSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class Banner extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, HeaderSelectors.banner, parentLocator);
  }

  public bannerMessage = this.getChildElementBySelector(Tags.span);
  public bannerMessageLink = this.bannerMessage.getChildElementBySelector(
    Tags.a,
  );
  public bannerIcon = this.getChildElementBySelector(Tags.svg).getNthElement(1);
  public closeButton = this.getChildElementBySelector(IconSelectors.cancelIcon);
}

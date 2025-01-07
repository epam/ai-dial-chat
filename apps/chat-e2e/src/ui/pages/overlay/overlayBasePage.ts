import { Attributes, Tags } from '@/src/ui/domData';
import { BasePage } from '@/src/ui/pages';
import { OverlaySelectors, layoutContainer } from '@/src/ui/selectors';
import { BaseElement, BaseLayoutContainer } from '@/src/ui/webElements';
import { Page } from '@playwright/test';

export class OverlayBasePage<T extends BaseLayoutContainer> extends BasePage {
  readonly overlayContainer: T;

  constructor(page: Page, overlayContainer: T) {
    super(page);
    this.overlayContainer = overlayContainer;
    this.overlayContainer.setElementLocator(
      page.frameLocator(OverlaySelectors.overlayFrame).locator(layoutContainer),
    );
  }

  getOverlayContainer(): T {
    return this.overlayContainer;
  }

  public overlayChatIcon = new BaseElement(
    this.page,
    OverlaySelectors.overlayChatIcon,
  );
  public overlayCollapseButton = new BaseElement(
    this.page,
    OverlaySelectors.overlayManagerCollapseButton,
  );
  public overlayFullScreenButton = new BaseElement(
    this.page,
    OverlaySelectors.overlayManagerFullScreenButton,
  );
  public overlayManagerContainer = new BaseElement(
    this.page,
    OverlaySelectors.overlayManagerContainer,
  );

  public async getTheme() {
    return new BaseElement(
      this.page,
      '',
      this.page.frameLocator(OverlaySelectors.overlayFrame).locator(Tags.html),
    ).getAttribute(Attributes.class);
  }
}

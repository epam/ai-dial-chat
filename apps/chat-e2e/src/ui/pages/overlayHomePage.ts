import { Attributes, Tags } from '@/src/ui/domData';
import { BasePage } from '@/src/ui/pages/basePage';
import { OverlaySelectors } from '@/src/ui/selectors/overlaySelectors';
import { BaseElement } from '@/src/ui/webElements';
import { OverlayContainer } from '@/src/ui/webElements/overlayContainer';

export class OverlayHomePage extends BasePage {
  private overlayContainer!: OverlayContainer;

  getOverlayContainer(): OverlayContainer {
    if (!this.overlayContainer) {
      this.overlayContainer = new OverlayContainer(this.page);
    }
    return this.overlayContainer;
  }

  public overlayChatIcon = new BaseElement(
    this.page,
    OverlaySelectors.overlayChatIcon,
  );

  public async getTheme() {
    return new BaseElement(
      this.page,
      '',
      this.page.frameLocator(OverlaySelectors.overlayFrame).locator(Tags.html),
    ).getAttribute(Attributes.class);
  }
}

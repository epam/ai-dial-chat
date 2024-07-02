import { BasePage } from '@/src/ui/pages/basePage';
import { AppContainer } from '@/src/ui/webElements';
import { OverlayContainer } from '@/src/ui/webElements/overlayContainer';

export class OverlayHomePage extends BasePage {
  private overlayContainer!: OverlayContainer;

  getOverlayContainer(): AppContainer {
    if (!this.overlayContainer) {
      this.overlayContainer = new OverlayContainer(this.page);
    }
    return this.overlayContainer;
  }
}

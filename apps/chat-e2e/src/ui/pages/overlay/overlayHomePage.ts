import { OverlayBasePage } from '@/src/ui/pages/overlay/overlayBasePage';
import { AppContainer } from '@/src/ui/webElements';
import { Page } from '@playwright/test';

export class OverlayHomePage extends OverlayBasePage<AppContainer> {
  constructor(page: Page) {
    super(page, new AppContainer(page));
  }
}

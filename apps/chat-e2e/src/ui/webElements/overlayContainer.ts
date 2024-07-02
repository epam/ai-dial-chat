import { appContainer, overlayFrame } from '@/src/ui/selectors';
import { AppContainer } from '@/src/ui/webElements/appContainer';
import { Page } from '@playwright/test';

export class OverlayContainer extends AppContainer {
  constructor(page: Page) {
    super(page);
    this.rootLocator = page.frameLocator(overlayFrame).locator(appContainer);
  }
}
import { ChatSelectors } from '@/e2e/src/ui/selectors';
import { BaseElement } from '@/e2e/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class Playback extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.playbackContainer);
  }
  public appTitle = this.getChildElementBySelector(
    ChatSelectors.playbackAppTitle,
  );
  public chatTitle = this.getChildElementBySelector(
    ChatSelectors.playbackChatTitle,
  );
}

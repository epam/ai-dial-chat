import { ChatSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
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

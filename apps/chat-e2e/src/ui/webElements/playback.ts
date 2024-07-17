import { PlaybackSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class Playback extends BaseElement {
  constructor(page: Page) {
    super(page, PlaybackSelectors.playbackContainer);
  }
  public appTitle = this.getChildElementBySelector(
    PlaybackSelectors.playbackAppTitle,
  );
  public chatTitle = this.getChildElementBySelector(
    PlaybackSelectors.playbackChatTitle,
  );
}

import { PlaybackSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { PlaybackMessage } from '@/src/ui/webElements/playbackMessage';
import { Locator, Page } from '@playwright/test';

export class PlaybackControl extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, PlaybackSelectors.playbackControl, parentLocator);
  }

  private playbackMessage!: PlaybackMessage;

  getPlaybackMessage(): PlaybackMessage {
    if (!this.playbackMessage) {
      this.playbackMessage = new PlaybackMessage(this.page, this.rootLocator);
    }
    return this.playbackMessage;
  }

  public playbackNextButton = this.getChildElementBySelector(
    PlaybackSelectors.playbackNext,
  );
  public playbackNextDisabledButton = this.getChildElementBySelector(
    PlaybackSelectors.playbackNextDisabled(),
  );
  public playbackPreviousButton = this.getChildElementBySelector(
    PlaybackSelectors.playbackPrevious,
  );
  public playbackPreviousDisabledButton = this.getChildElementBySelector(
    PlaybackSelectors.playbackPreviousDisabled(),
  );
}

import { PlaybackSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { PlaybackMessage } from '@/src/ui/webElements/playbackMessage';
import { Page } from '@playwright/test';

export class PlaybackControl extends BaseElement {
  constructor(page: Page) {
    super(page, PlaybackSelectors.playbackControl);
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

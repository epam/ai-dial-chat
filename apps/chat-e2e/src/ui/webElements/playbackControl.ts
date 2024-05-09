import { PlaybackSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class PlaybackControl extends BaseElement {
  constructor(page: Page) {
    super(page, PlaybackSelectors.playbackControl);
  }
  public playbackMessage = this.getChildElementBySelector(
    PlaybackSelectors.playbackMessage,
  );
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

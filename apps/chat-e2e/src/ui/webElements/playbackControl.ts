import { ChatSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class PlaybackControl extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.playbackControl);
  }
  public playbackMessage = this.getChildElementBySelector(
    ChatSelectors.playbackMessage,
  );
  public playbackNextButton = this.getChildElementBySelector(
    ChatSelectors.playbackNext,
  );
  public playbackNextDisabledButton = this.getChildElementBySelector(
    ChatSelectors.playbackNextDisabled(),
  );
  public playbackPreviousButton = this.getChildElementBySelector(
    ChatSelectors.playbackPrevious,
  );
  public playbackPreviousDisabledButton = this.getChildElementBySelector(
    ChatSelectors.playbackPreviousDisabled(),
  );
}

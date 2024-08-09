import { PlaybackSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { InputAttachments } from '@/src/ui/webElements/inputAttachments';
import { Locator, Page } from '@playwright/test';

export class PlaybackMessage extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, PlaybackSelectors.playbackMessage, parentLocator);
  }

  private playbackMessageInputAttachments!: InputAttachments;

  getPlaybackMessageInputAttachments(): InputAttachments {
    if (!this.playbackMessageInputAttachments) {
      this.playbackMessageInputAttachments = new InputAttachments(
        this.page,
        this.rootLocator,
      );
    }
    return this.playbackMessageInputAttachments;
  }

  public playbackMessageContent = this.getChildElementBySelector(
    PlaybackSelectors.playbackMessageContent,
  );

  public async getPlaybackMessageContent() {
    return this.playbackMessageContent.getElementContent();
  }
}

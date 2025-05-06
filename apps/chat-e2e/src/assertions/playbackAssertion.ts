import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ElementState, ExpectedMessages } from '@/src/testData';
import { PlaybackControl } from '@/src/ui/webElements/playbackControl';
import { expect } from '@playwright/test';

export class PlaybackAssertion extends BaseAssertion {
  readonly playbackControl: PlaybackControl;

  constructor(playbackControl: PlaybackControl) {
    super();
    this.playbackControl = playbackControl;
  }

  public async assertPlaybackMessageContent(expectedContent: string) {
    await super.assertElementText(
      this.playbackControl.getPlaybackMessage(),
      expectedContent,
      ExpectedMessages.playbackChatMessageIsValid,
    );
  }

  public async assertPlaybackMessageAttachmentState(
    attachmentName: string,
    expectedState: ElementState,
  ) {
    const playbackMessageAttachment = this.playbackControl
      .getPlaybackMessage()
      .getPlaybackMessageInputAttachments()
      .inputAttachment(attachmentName);
    expectedState === 'visible'
      ? await expect
          .soft(playbackMessageAttachment, ExpectedMessages.fileIsAttached)
          .toBeVisible()
      : await expect
          .soft(playbackMessageAttachment, ExpectedMessages.fileIsNotAttached)
          .toBeHidden();
  }
}

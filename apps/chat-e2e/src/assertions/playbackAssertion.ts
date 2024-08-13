import { ElementState, ExpectedMessages } from '@/src/testData';
import { PlaybackControl } from '@/src/ui/webElements/playbackControl';
import { expect } from '@playwright/test';

export class PlaybackAssertion {
  readonly playbackControl: PlaybackControl;

  constructor(playbackControl: PlaybackControl) {
    this.playbackControl = playbackControl;
  }

  public async assertPlaybackMessageContent(expectedContent: string) {
    const playbackMessage = await this.playbackControl
      .getPlaybackMessage()
      .getPlaybackMessageContent();
    expect
      .soft(playbackMessage, ExpectedMessages.playbackChatMessageIsValid)
      .toBe(expectedContent);
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

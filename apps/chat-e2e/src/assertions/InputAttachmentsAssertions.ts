import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ElementState } from '@/src/testData';
import { InputAttachments } from '@/src/ui/webElements';

export class InputAttachmentsAssertions extends BaseAssertion {
  private inputAttachments: InputAttachments;
  constructor(inputAttachments: InputAttachments) {
    super();
    this.inputAttachments = inputAttachments;
  }

  public async assertAttachedFileState(
    name: string,
    expectedState: ElementState,
  ) {
    await this.assertElementState(
      this.inputAttachments.inputAttachment(name),
      expectedState,
    );
  }

  public async assertFileIsAttached(name: string, expectedState: ElementState) {
    await this.assertAttachedFileState(name, expectedState);
    if (expectedState === 'visible') {
      await this.assertElementState(
        this.inputAttachments.inputAttachmentLoadingIndicator(name),
        'hidden',
      );
    }
  }
}

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
    return this.assertElementState(
      this.inputAttachments.inputAttachment(name),
      expectedState,
    );
  }
}

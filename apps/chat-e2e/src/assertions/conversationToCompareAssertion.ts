import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ElementState } from '@/src/testData';
import { ConversationToCompare } from '@/src/ui/webElements';

export class ConversationToCompareAssertion extends BaseAssertion {
  readonly conversationToCompare: ConversationToCompare;

  constructor(conversationToCompare: ConversationToCompare) {
    super();
    this.conversationToCompare = conversationToCompare;
  }

  public async assertConversationToCompareState(
    expectedState: ElementState,
    expectedMessage?: string,
  ) {
    await this.assertElementState(
      this.conversationToCompare,
      expectedState,
      expectedMessage,
    );
  }
}

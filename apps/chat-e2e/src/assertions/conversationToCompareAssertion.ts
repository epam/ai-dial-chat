import { BaseAssertion } from '@/src/assertions/baseAssertion';
import { ConversationToCompare } from '@/src/ui/webElements';

export class ConversationToCompareAssertion extends BaseAssertion {
  readonly conversationToCompare: ConversationToCompare;

  constructor(conversationToCompare: ConversationToCompare) {
    super();
    this.conversationToCompare = conversationToCompare;
  }
}

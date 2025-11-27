import { EntityTreeAssertion } from '@/src/assertions/base/entityTreeAssertion';
import { ReplaceConfirmationModalConversations } from '@/src/ui/webElements/replaceConfirmationModalConversations';

export class ReplaceConfirmationModalConversationsAssertion extends EntityTreeAssertion<ReplaceConfirmationModalConversations> {
  constructor(conversations: ReplaceConfirmationModalConversations) {
    super(conversations);
  }
}

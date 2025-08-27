import { SideBarConversationAssertion } from '@/src/assertions/sideBarConversationAssertion';
import { Chronology, ExpectedMessages } from '@/src/testData';
import { ConversationsTree } from '@/src/ui/webElements/entityTree';
import { expect } from '@playwright/test';

export class ConversationAssertion extends SideBarConversationAssertion<ConversationsTree> {
  public async assertConversationInToday(conversationName: string) {
    const todayConversations =
      await this.sideBarConversationsTree.getChronologyConversations(
        Chronology.today,
      );
    expect(todayConversations, ExpectedMessages.conversationOfToday).toContain(
      conversationName,
    );
  }
}

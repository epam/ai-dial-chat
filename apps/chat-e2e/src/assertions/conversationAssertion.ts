import { SideBarEntityAssertion } from '@/src/assertions/sideBarEntityAssertion';
import {
  Chronology,
  ElementState,
  ExpectedMessages,
  TreeEntity,
} from '@/src/testData';
import { Colors, Styles } from '@/src/ui/domData';
import { ConversationsTree } from '@/src/ui/webElements/entityTree';
import { expect } from '@playwright/test';

export class ConversationAssertion extends SideBarEntityAssertion<ConversationsTree> {
  public async assertReplayIconState(
    entity: TreeEntity,
    expectedState: ElementState,
  ) {
    const entityIcon = this.sideBarEntitiesTree.getEntityReplayIcon(
      entity.name,
      entity.index,
    );
    expectedState === 'visible'
      ? await expect
          .soft(entityIcon, ExpectedMessages.chatBarConversationIconIsReplay)
          .toBeVisible()
      : await expect
          .soft(entityIcon, ExpectedMessages.chatBarConversationIconIsNotReplay)
          .toBeHidden();
  }

  public async assertConversationCursor(
    conversationName: string,
    expectedCursor: string,
  ) {
    await this.sideBarEntitiesTree.getEntityByName(conversationName).hover();
    const style = await this.sideBarEntitiesTree
      .getEntityName(conversationName)
      .getComputedStyleProperty(Styles.cursor);
    expect
      .soft(style[0], `Conversation cursor is ${expectedCursor}`)
      .toBe(expectedCursor);
  }

  public async assertSelectedConversation(conversationName: string) {
    const conversationBackgroundColor =
      await this.sideBarEntitiesTree.getEntityBackgroundColor(conversationName);
    expect
      .soft(
        conversationBackgroundColor,
        ExpectedMessages.conversationIsSelected,
      )
      .toBe(Colors.backgroundAccentSecondary);
  }

  public async assertConversationInToday(conversationName: string) {
    const todayConversations =
      await this.sideBarEntitiesTree.getChronologyConversations(
        Chronology.today,
      );
    expect(todayConversations, ExpectedMessages.conversationOfToday).toContain(
      conversationName,
    );
  }
}

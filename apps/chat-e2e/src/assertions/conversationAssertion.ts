import { SideBarEntityAssertion } from '@/src/assertions/sideBarEntityAssertion';
import { ElementState, ExpectedMessages, TreeEntity } from '@/src/testData';
import { Colors, Cursors, Styles } from '@/src/ui/domData';
import { Conversations } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class ConversationAssertion extends SideBarEntityAssertion<Conversations> {
  public async assertReplayIconState(
    entity: TreeEntity,
    expectedState: ElementState,
  ) {
    const entityIcon = this.sideBarEntities.getConversationReplayIcon(
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
    await this.sideBarEntities.getEntityByName(conversationName).hover();
    const style = await this.sideBarEntities
      .getConversationName(conversationName)
      .getComputedStyleProperty(Styles.cursor);
    expect
      .soft(style[0], `Conversation cursor is ${expectedCursor}`)
      .toBe(expectedCursor);
  }

  public async assertSelectedConversation(conversationName: string) {
    const conversationBackgroundColor =
      await this.sideBarEntities.getEntityBackgroundColor(conversationName);
    expect
      .soft(conversationBackgroundColor, 'Conversation is selected')
      .toBe(Colors.backgroundAccentSecondary);
  }
}

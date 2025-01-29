import { SideBarEntityAssertion } from '@/src/assertions/sideBarEntityAssertion';
import {
  Chronology,
  ElementState,
  ExpectedMessages,
  TreeEntity,
} from '@/src/testData';
import { Colors, Styles } from '@/src/ui/domData';
import { ChatBarSelectors } from '@/src/ui/selectors';
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
    const selectedEntity =
      this.sideBarEntitiesTree.selectedConversation(conversationName);

    await this.assertElementState(selectedEntity, 'visible');
    await this.assertEntityBackgroundColor(
      { name: conversationName },
      Colors.backgroundAccentSecondary,
    );
  }

  public async assertNoConversationIsSelected() {
    const entitiesWithIndices =
      await this.sideBarEntitiesTree.getAllTreeEntitiesWithIndices();
    const selectedEntities = [];

    for (const { name, index } of entitiesWithIndices) {
      const hasSelectedClass =
        (await this.sideBarEntitiesTree
          .getEntityByName(name, index)
          .locator(ChatBarSelectors.selectedEntity)
          .count()) > 0;

      const entityBackgroundColor =
        await this.sideBarEntitiesTree.getEntityBackgroundColor(name, index);

      if (
        hasSelectedClass ||
        entityBackgroundColor === Colors.backgroundAccentSecondary
      ) {
        selectedEntities.push({ name, index });
      }
    }

    expect
      .soft(selectedEntities.length, ExpectedMessages.noConversationIsSelected)
      .toBe(0);
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

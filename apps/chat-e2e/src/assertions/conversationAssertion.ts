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
    const selectedEntity = this.sideBarEntitiesTree
      .getEntityByName(conversationName)
      .locator(ChatBarSelectors.selectedEntity);

    await expect
      .soft(selectedEntity, ExpectedMessages.conversationIsSelected)
      .toBeVisible();

    const conversationBackgroundColor =
      await this.sideBarEntitiesTree.getEntityBackgroundColor(conversationName);
    expect
      .soft(
        conversationBackgroundColor,
        ExpectedMessages.conversationIsSelected,
      )
      .toBe(Colors.backgroundAccentSecondary);
  }

  public async assertNoConversationIsSelected() {
    const allEntities = await this.sideBarEntitiesTree.getAllTreeEntities();
    const selectedEntities = [];

    for (const entity of allEntities) {
      const hasSelectedClass =
        (await entity.locator(ChatBarSelectors.selectedEntity).count()) > 0;

      if (hasSelectedClass) {
        const backgroundColor = await entity.evaluate(
          (el) => window.getComputedStyle(el).backgroundColor,
        );
        if (backgroundColor === Colors.backgroundAccentSecondary) {
          selectedEntities.push(entity);
        }
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

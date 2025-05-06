import { SideBarEntityAssertion } from '@/src/assertions/sideBarEntityAssertion';
import { ElementState, ExpectedMessages, TreeEntity } from '@/src/testData';
import { Cursors, ThemeColorAttributes } from '@/src/ui/domData';
import { BaseSideBarConversationTree } from '@/src/ui/webElements/entityTree';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { expect } from '@playwright/test';

export class SideBarConversationAssertion<
  T extends BaseSideBarConversationTree,
> extends SideBarEntityAssertion<BaseSideBarConversationTree> {
  readonly sideBarConversationsTree: T;

  constructor(sideBarConversationsTree: T) {
    super(sideBarConversationsTree);
    this.sideBarConversationsTree = sideBarConversationsTree;
  }

  public async assertSelectedConversation(conversationName: string) {
    const selectedEntity =
      this.sideBarEntitiesTree.selectedConversation(conversationName);

    await this.assertElementState(selectedEntity, 'visible');
    await this.assertEntityBackgroundColor(
      { name: conversationName },
      ThemesUtil.getRgbColorByKey(ThemeColorAttributes.bgAccentSecondaryAlpha),
    );
  }

  public async assertConversationCursor(
    conversationName: string,
    expectedCursor: Cursors,
  ) {
    await this.sideBarEntitiesTree.getEntityByName(conversationName).hover();
    await super.assertElementCursor(
      this.sideBarEntitiesTree.getEntityName(conversationName),
      expectedCursor,
    );
  }

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

  public async assertNoConversationIsSelected() {
    const selectedEntities =
      await this.sideBarConversationsTree.getSelectedEntities();
    expect
      .soft(selectedEntities.length, ExpectedMessages.noConversationIsSelected)
      .toBe(0);
  }
}

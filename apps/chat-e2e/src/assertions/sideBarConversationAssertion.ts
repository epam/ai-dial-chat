import { SideBarEntityAssertion } from '@/src/assertions/sideBarEntityAssertion';
import { ElementState, ExpectedMessages, TreeEntity } from '@/src/testData';
import { SideBarEntitiesTree } from '@/src/ui/webElements/entityTree';
import { expect } from '@playwright/test';

export class SideBarConversationAssertion<
  T extends SideBarEntitiesTree,
> extends SideBarEntityAssertion<SideBarEntitiesTree> {
  readonly sideBarConversationsTree: T;

  constructor(sideBarConversationsTree: T) {
    super(sideBarConversationsTree);
    this.sideBarConversationsTree = sideBarConversationsTree;
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
}

import { SideBarEntityAssertion } from '@/src/assertions/sideBarEntityAssertion';
import { ElementState, ExpectedMessages, TreeEntity } from '@/src/testData';
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
}

import { SideBarEntityAssertion } from '@/src/assertions/sideBarEntityAssertion';
import { ExpectedMessages, TreeEntity } from '@/src/testData';
import { SharedWithMePromptsTree } from '@/src/ui/webElements/entityTree';
import { expect } from '@playwright/test';

export class SharedWithMePromptsAssertion extends SideBarEntityAssertion<SharedWithMePromptsTree> {
  public async assertSharedEntityBackgroundColor(
    entity: TreeEntity,
    expectedColor: string,
  ) {
    const entityBackgroundColor =
      await this.sideBarEntitiesTree.getEntityBackgroundColor(
        entity.name,
        entity.index,
      );
    expect
      .soft(
        entityBackgroundColor,
        ExpectedMessages.entityBackgroundColorIsValid,
      )
      .toBe(expectedColor);
  }
}

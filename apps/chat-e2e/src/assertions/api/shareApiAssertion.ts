import { BackendChatEntity } from '@/chat/types/common';
import { ElementState, ExpectedMessages } from '@/src/testData';
import { ShareEntity } from '@epam/ai-dial-shared';
import { expect } from '@playwright/test';

export class ShareApiAssertion {
  public async assertSharedWithMeEntityState(
    sharedEntities: {
      resources: BackendChatEntity[];
    },
    entity: ShareEntity,
    expectedState: ElementState,
  ) {
    expectedState === 'visible'
      ? expect
          .soft(
            sharedEntities.resources.find((e) => e.url === entity.id),
            ExpectedMessages.entityIsShared,
          )
          .toBeDefined()
      : expect
          .soft(
            sharedEntities.resources.find((e) => e.url === entity.id),
            ExpectedMessages.entityIsNotShared,
          )
          .toBeUndefined();
  }

  public async assertSharedWithMeEntitiesCount(
    sharedEntities: {
      resources: BackendChatEntity[];
    },
    entity: ShareEntity,
  ) {
    expect
      .soft(
        sharedEntities.resources.filter((e) => e.url === entity.id).length,
        ExpectedMessages.entityIsShared,
      )
      .toBe(1);
  }
}

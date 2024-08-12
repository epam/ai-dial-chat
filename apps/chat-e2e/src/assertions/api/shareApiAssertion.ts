import { BackendChatEntity, ShareEntity } from '@/chat/types/common';
import { ElementState, ExpectedMessages } from '@/src/testData';
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
}

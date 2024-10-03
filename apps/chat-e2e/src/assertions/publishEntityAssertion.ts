import { EntityTreeAssertion } from '@/src/assertions/entityTreeAssertion';
import { PublishingExpectedMessages, TreeEntity } from '@/src/testData';
import { PublishEntitiesTree } from '@/src/ui/webElements/entityTree';
import { expect } from '@playwright/test';

export class PublishEntityAssertion<
  T extends PublishEntitiesTree,
> extends EntityTreeAssertion<PublishEntitiesTree> {
  readonly publishEntities: T;

  constructor(publishEntities: T) {
    super(publishEntities);
    this.publishEntities = publishEntities;
  }

  public async assertEntityVersion(
    entity: TreeEntity,
    expectedVersion: string,
  ) {
    await expect
      .soft(
        this.publishEntities.getEntityVersion(entity.name, entity.index),
        PublishingExpectedMessages.entityVersionIsValid,
      )
      .toHaveText(expectedVersion);
  }
}

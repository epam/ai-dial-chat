import { EntityTreeAssertion } from '@/src/assertions/base/entityTreeAssertion';
import {
  CheckboxState,
  ElementState,
  PublishingExpectedMessages,
  TreeEntity,
} from '@/src/testData';
import { PublishEntitiesTree } from '@/src/ui/webElements/entityTree';

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
    await this.assertElementText(
      this.publishEntities.getEntityVersion(entity.name, entity.index),
      expectedVersion,
      PublishingExpectedMessages.entityVersionIsValid,
    );
  }

  public async assertEntityVersionColor(
    entity: TreeEntity,
    expectedColor: string,
  ) {
    await this.assertElementColor(
      this.publishEntities.getEntityVersionElement(entity.name, entity.index),
      expectedColor,
    );
  }

  public async assertEntityToPublish(
    entity: TreeEntity,
    entityAttributes: {
      expectedState: ElementState;
      expectedColor?: string;
      expectedCheckboxState?: CheckboxState;
      expectedVersion?: string;
      expectedVersionColor?: string;
    },
  ) {
    await this.assertEntityState(entity, entityAttributes.expectedState);
    if (entityAttributes.expectedState === 'visible') {
      if (entityAttributes.expectedColor) {
        await this.assertEntityColor(entity, entityAttributes.expectedColor);
      }
      if (entityAttributes.expectedCheckboxState) {
        await this.assertEntityCheckboxState(
          entity,
          entityAttributes.expectedCheckboxState,
        );
      }
      if (entityAttributes.expectedVersion) {
        await this.assertEntityVersion(
          entity,
          entityAttributes.expectedVersion,
        );
      }
      if (entityAttributes.expectedVersionColor) {
        await this.assertEntityVersionColor(
          entity,
          entityAttributes.expectedVersionColor,
        );
      }
    }
  }
}

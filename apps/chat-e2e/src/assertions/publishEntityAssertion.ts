import { EntityTreeAssertion } from '@/src/assertions/entityTreeAssertion';
import {
  ExpectedMessages,
  PublishingExpectedMessages,
  TreeEntity,
} from '@/src/testData';
import { Styles } from '@/src/ui/domData';
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
    const style = await this.publishEntities
      .getEntityVersionElement(entity.name, entity.index)
      .getComputedStyleProperty(Styles.color);
    expect
      .soft(style[0], ExpectedMessages.elementColorIsValid)
      .toBe(expectedColor);
  }
}

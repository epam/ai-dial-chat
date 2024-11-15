import { PublishEntitySelectors } from '@/src/ui/selectors';
import { EntitiesTree } from '@/src/ui/webElements/entityTree';

export class PublishEntitiesTree extends EntitiesTree {
  public getEntityVersion(entityName: string, entityIndex?: number) {
    return this.getEntityByName(entityName, entityIndex)
      .locator('~*')
      .locator(PublishEntitySelectors.version);
  }
}

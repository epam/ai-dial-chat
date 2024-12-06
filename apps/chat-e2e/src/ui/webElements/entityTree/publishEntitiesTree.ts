import { PublishEntitySelectors } from '@/src/ui/selectors';
import { EntitiesTree } from '@/src/ui/webElements/entityTree';

export class PublishEntitiesTree extends EntitiesTree {
  public getEntityVersion(entityName: string, entityIndex?: number) {
    return this.getEntityByName(entityName, entityIndex).locator(
      `~*${PublishEntitySelectors.version}, ~* > ${PublishEntitySelectors.version}`,
    );
  }

  public getEntityVersionElement(entityName: string, entityIndex?: number) {
    return this.createElementFromLocator(
      this.getEntityVersion(entityName, entityIndex),
    );
  }
}

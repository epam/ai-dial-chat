import { Tags } from '@/src/ui/domData';
import { EntitySelectors, IconSelectors } from '@/src/ui/selectors';
import { EntitiesTree } from '@/src/ui/webElements/entityTree/entitiesTree';

export class PublishEntitiesTree extends EntitiesTree {
  public getEntityVersion(entityName: string, entityIndex?: number) {
    return this.getEntityByName(entityName, entityIndex).locator(
      `~*${EntitySelectors.version}, ~* > ${EntitySelectors.version}`,
    );
  }

  public getEntityVersionElement(entityName: string, entityIndex?: number) {
    return this.createElementFromLocator(
      this.getEntityVersion(entityName, entityIndex),
    );
  }

  public getEntityVersionInput(entityName: string, entityIndex?: number) {
    return this.getEntityByName(entityName, entityIndex)
      .locator('~*')
      .locator(`${Tags.input}${EntitySelectors.version}`);
  }

  public getEntityVersionErrorIcon(entityName: string, entityIndex?: number) {
    return this.getEntityVersionInput(entityName, entityIndex)
      .locator('~*')
      .locator(IconSelectors.exclamationCircleIcon);
  }

  public getEntityNameInput(entityName: string, entityIndex?: number) {
    return this.getEntityByName(entityName, entityIndex).locator(
      EntitySelectors.entityInput,
    );
  }
}

import { Tags } from '@/src/ui/domData';
import { EntitySelectors, IconSelectors } from '@/src/ui/selectors';
import { EntitiesTree } from '@/src/ui/webElements/entityTree/entitiesTree';
import { PublishVersionChecklistDropdown } from '@/src/ui/webElements/publishVersionChecklistDropdown';

export class PublishEntitiesTree extends EntitiesTree {
  private versionChecklistDropdown!: PublishVersionChecklistDropdown;

  getVersionChecklistDropdown(): PublishVersionChecklistDropdown {
    if (!this.versionChecklistDropdown) {
      this.versionChecklistDropdown = new PublishVersionChecklistDropdown(
        this.page,
      );
    }
    return this.versionChecklistDropdown;
  }

  public getEntityVersion(entityName: string, entityIndex?: number) {
    return this.getEntityByName(entityName, entityIndex)
      .locator('..')
      .locator(`${EntitySelectors.version}`)
      .last()
      .locator(Tags.span)
      .first();
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

import { EntityTreeSelectors } from '@/src/ui/selectors';
import { Folders } from '@/src/ui/webElements/entityTree';

export class PublishFolder extends Folders {
  public getFolderEntityVersion(
    folderName: string,
    entityName: string,
    folderIndex?: number,
    entityIndex?: number,
  ) {
    return this.getFolderEntity(
      folderName,
      entityName,
      folderIndex,
      entityIndex,
    )
      .locator('~*')
      .locator(EntityTreeSelectors.version);
  }
}

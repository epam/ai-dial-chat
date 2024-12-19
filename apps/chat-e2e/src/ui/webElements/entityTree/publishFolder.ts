import { PublishEntitySelectors } from '@/src/ui/selectors';
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
    ).locator(
      `~*${PublishEntitySelectors.version}, ~* > ${PublishEntitySelectors.version}`,
    );
  }

  public getFolderEntityVersionElement(
    folderName: string,
    entityName: string,
    folderIndex?: number,
    entityIndex?: number,
  ) {
    return this.createElementFromLocator(
      this.getFolderEntityVersion(
        folderName,
        entityName,
        folderIndex,
        entityIndex,
      ),
    );
  }
}

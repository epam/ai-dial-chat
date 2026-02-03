import { EntitySelectors, FolderSelectors } from '@/src/ui/selectors';
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
    ).locator(`~*${EntitySelectors.version}, ~* > ${EntitySelectors.version}`);
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

  public getFolderNameInput(folderName: string) {
    return this.getFolderByName(folderName).locator(
      FolderSelectors.folderInput,
    );
  }
}

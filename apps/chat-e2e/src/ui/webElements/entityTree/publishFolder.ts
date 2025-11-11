import { PublishEntitySelectors } from '@/src/ui/selectors';
import { Folders } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class PublishFolder extends Folders {
  constructor(
    page: Page,
    parentLocator: Locator,
    folderSelector: string,
    entitySelector?: string,
  ) {
    super(page, parentLocator, folderSelector, entitySelector);
  }

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

  public getFolderNameInput(folderName: string) {
    return this.getFolderByName(folderName).locator(
      `[data-qa="folder-input"]`,
    );
  }
}

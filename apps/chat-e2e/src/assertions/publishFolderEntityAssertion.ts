import { FolderAssertion } from '@/src/assertions/folderAssertion';
import { PublishingExpectedMessages, TreeEntity } from '@/src/testData';
import { PublishFolder } from '@/src/ui/webElements/entityTree';

export class PublishFolderEntityAssertion<
  T extends PublishFolder,
> extends FolderAssertion<PublishFolder> {
  readonly publishFolderEntities: T;

  constructor(publishFolderEntities: T) {
    super(publishFolderEntities);
    this.publishFolderEntities = publishFolderEntities;
  }

  public async assertFolderEntityVersion(
    folder: TreeEntity,
    folderEntity: TreeEntity,
    expectedVersion: string,
  ) {
    await this.assertElementText(
      this.publishFolderEntities.getFolderEntityVersion(
        folder.name,
        folderEntity.name,
        folder.index,
        folderEntity.index,
      ),
      expectedVersion,
      PublishingExpectedMessages.entityVersionIsValid,
    );
  }

  public async assertFolderEntityVersionColor(
    folder: TreeEntity,
    folderEntity: TreeEntity,
    expectedColor: string,
  ) {
    await this.assertElementColor(
      this.publishFolderEntities.getFolderEntityVersionElement(
        folder.name,
        folderEntity.name,
        folder.index,
        folderEntity.index,
      ),
      expectedColor,
    );
  }
}

import { FolderAssertion } from '@/src/assertions/folderAssertion';
import { PublishingExpectedMessages, TreeEntity } from '@/src/testData';
import { PublishFolder } from '@/src/ui/webElements/entityTree';

export class PublishFolderAssertion<
  T extends PublishFolder,
> extends FolderAssertion<PublishFolder> {
  readonly publishFolder: T;

  constructor(publishFolder: T) {
    super(publishFolder);
    this.publishFolder = publishFolder;
  }

  public async assertFolderEntityVersion(
    folder: TreeEntity,
    folderEntity: TreeEntity,
    expectedVersion: string,
  ) {
    await this.assertElementText(
      this.publishFolder.getFolderEntityVersion(
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
      this.publishFolder.getFolderEntityVersionElement(
        folder.name,
        folderEntity.name,
        folder.index,
        folderEntity.index,
      ),
      expectedColor,
    );
  }
}

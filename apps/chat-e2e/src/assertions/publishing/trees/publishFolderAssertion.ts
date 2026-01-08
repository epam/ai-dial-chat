import { FolderAssertion } from '@/src/assertions/folderAssertion';
import {
  CheckboxState,
  ElementState,
  PublishingExpectedMessages,
  TreeEntity,
} from '@/src/testData';
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

  public async assertFolderEntityToPublish(
    folder: TreeEntity,
    folderEntity: TreeEntity,
    folderEntityAttributes: {
      expectedState: ElementState;
      expectedColor?: string;
      expectedCheckboxState?: CheckboxState;
      expectedVersion?: string;
      expectedVersionColor?: string;
    },
  ) {
    await this.assertFolderEntityState(
      folder,
      folderEntity,
      folderEntityAttributes.expectedState,
    );
    if (folderEntityAttributes.expectedState === 'visible') {
      if (folderEntityAttributes.expectedColor) {
        await this.assertFolderEntityColor(
          folder,
          folderEntity,
          folderEntityAttributes.expectedColor,
        );
      }
      if (folderEntityAttributes.expectedCheckboxState) {
        await this.assertFolderEntityCheckboxState(
          folder,
          folderEntity,
          folderEntityAttributes.expectedCheckboxState,
        );
      }
      if (folderEntityAttributes.expectedVersion) {
        await this.assertFolderEntityVersion(
          folder,
          folderEntity,
          folderEntityAttributes.expectedVersion,
        );
      }
      if (folderEntityAttributes.expectedVersionColor) {
        await this.assertFolderEntityVersionColor(
          folder,
          folderEntity,
          folderEntityAttributes.expectedVersionColor,
        );
      }
    }
  }
}

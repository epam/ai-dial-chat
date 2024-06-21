import { FolderType } from '@/chat/types/folder';
import { FolderBuilder } from '@/src/testData/conversationHistory/folderBuilder';
import { GeneratorUtil } from '@/src/utils';

export class FolderData {
  private folderBuilder: FolderBuilder;

  constructor(type: FolderType) {
    this.folderBuilder = new FolderBuilder().withType(type);
  }

  public resetFolderData() {
    const type = this.folderBuilder.getFolder().type;
    this.folderBuilder = new FolderBuilder().withType(type);
  }

  public prepareDefaultFolder() {
    return this.folderBuilder.build();
  }

  public prepareFolder(name?: string) {
    const folderName = name ?? GeneratorUtil.randomString(7);
    return this.folderBuilder.withName(folderName).withId(folderName).build();
  }

  public prepareNestedFolder(
    nestedLevel: number,
    type: FolderType,
    folderNames?: Record<number, string>,
  ) {
    const rootFolder = this.prepareFolder(
      folderNames ? folderNames[1] : undefined,
    );
    this.resetFolderData();
    const foldersHierarchy = [rootFolder];
    for (let i = 1; i <= nestedLevel; i++) {
      const nestedFolderName =
        folderNames !== undefined
          ? folderNames[i + 1]
          : GeneratorUtil.randomString(7);
      const nestedFolder = this.folderBuilder
        .withName(nestedFolderName)
        .withType(type)
        .withId(`${foldersHierarchy[i - 1].id}/${nestedFolderName}`)
        .withFolderId(foldersHierarchy[i - 1].id)
        .build();
      foldersHierarchy.push(nestedFolder);
      this.resetFolderData();
    }
    return foldersHierarchy;
  }
}

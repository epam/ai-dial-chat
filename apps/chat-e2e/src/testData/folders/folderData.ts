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
    return this.folderBuilder
      .withName(folderName)
      .withFolderId(folderName)
      .build();
  }

  public prepareNestedFolder(nestedLevel: number, type: FolderType) {
    const rootFolder = this.prepareFolder();
    this.resetFolderData();
    const foldersHierarchy = [rootFolder];
    for (let i = 1; i <= nestedLevel; i++) {
      const nestedFolderName = GeneratorUtil.randomString(7);
      const nestedFolder = this.folderBuilder
        .withName(nestedFolderName)
        .withType(type)
        .withFolderId(`${foldersHierarchy[i - 1].folderId}/${nestedFolderName}`)
        .build();
      foldersHierarchy.push(nestedFolder);
      this.resetFolderData();
    }
    return foldersHierarchy;
  }
}

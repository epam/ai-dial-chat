import { FolderType } from '@/ai-dial-chat/types/folder';

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
    return this.folderBuilder
      .withName(name ?? GeneratorUtil.randomString(7))
      .build();
  }

  public prepareNestedFolder(nestedLevel: number, type: FolderType) {
    const rootFolder = this.prepareFolder();
    this.resetFolderData();
    const foldersHierarchy = [rootFolder];
    for (let i = 1; i <= nestedLevel; i++) {
      const nestedFolder = this.folderBuilder
        .withName(GeneratorUtil.randomString(7))
        .withType(type)
        .withFolderId(foldersHierarchy[foldersHierarchy.length - 1].id)
        .build();
      foldersHierarchy.push(nestedFolder);
      this.resetFolderData();
    }
    return foldersHierarchy;
  }
}

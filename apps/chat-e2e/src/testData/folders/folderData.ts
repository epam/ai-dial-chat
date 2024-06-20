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

  public prepareNestedFolder(
    nestedLevel: number,
    type: FolderType,
    name?: string,
  ) {
    const rootFolder = this.prepareFolder();
    this.resetFolderData();
    const foldersHierarchy = [rootFolder];
    if (name != null) {
      for (let i = 1; i <= nestedLevel; i++) {
        let nestedFolderName = name + ' ' + i;
        const nestedFolder = this.folderBuilder
          .withName(nestedFolderName)
          .withType(type)
          .withId(`${foldersHierarchy[i - 1].id}/${nestedFolderName}`)
          .withFolderId(foldersHierarchy[i - 1].id)
          .build();
        foldersHierarchy.push(nestedFolder);
        this.resetFolderData();
      }
    } else {
      for (let i = 1; i <= nestedLevel; i++) {
        const nestedFolderName = GeneratorUtil.randomString(7);
        const nestedFolder = this.folderBuilder
          .withName(nestedFolderName)
          .withType(type)
          .withId(`${foldersHierarchy[i - 1].id}/${nestedFolderName}`)
          .withFolderId(foldersHierarchy[i - 1].id)
          .build();
        foldersHierarchy.push(nestedFolder);
        this.resetFolderData();
      }
    }
    return foldersHierarchy;
  }

  public prepareFolder(name?: string) {
    const folderName = name ?? GeneratorUtil.randomString(7);
    return this.folderBuilder.withName(folderName).withId(folderName).build();
  }

  private buildFolderId(parentFolderId: string, folderName: string) {
    return `${parentFolderId}/${folderName}`;
  }

  private createNestedFolder(parentFolderId: string, type: FolderType, name: string) {
    const nestedFolder = this.folderBuilder
      .withName(name)
      .withType(type)
      .withId(this.buildFolderId(parentFolderId, name))
      .withFolderId(parentFolderId)
      .build();
    return nestedFolder;
  }

  public prepareClassicNestedFolders(nestedLevel: number, type: FolderType, name?: string) {
    let rootFolder = this.prepareFolder(`${name} 1`);
    const foldersHierarchy = [rootFolder];
    this.resetFolderData();

    for (let i = 2; i <= nestedLevel; i++) {
        const nestedFolderName = name != null ? `${name} ${i}` : GeneratorUtil.randomString(7);
        const nestedFolder = this.createNestedFolder(foldersHierarchy[i - 2].id, type, nestedFolderName);
        foldersHierarchy.push(nestedFolder);
        this.resetFolderData();
    }
    return foldersHierarchy;
  }
}

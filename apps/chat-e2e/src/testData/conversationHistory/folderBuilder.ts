import { FolderInterface, FolderType } from '@/chat/types/folder';
import { ExpectedConstants } from '@/src/testData';

export interface TestFolder extends Omit<FolderInterface, 'folderId'> {
  folderId?: string | undefined;
}

export class FolderBuilder {
  private folder: TestFolder;

  constructor() {
    this.folder = {
      id: '',
      name: ExpectedConstants.newFolderTitle,
      type: FolderType.Chat,
    };
  }

  getFolder() {
    return this.folder;
  }

  withId(id: string): FolderBuilder {
    this.folder.id = id;
    return this;
  }

  withName(name: string): FolderBuilder {
    this.folder.name = name;
    return this;
  }

  withType(type: FolderType): FolderBuilder {
    this.folder.type = type;
    return this;
  }

  withFolderId(folderId: string): FolderBuilder {
    this.folder.folderId = folderId;
    return this;
  }

  build(): TestFolder {
    return this.folder;
  }
}

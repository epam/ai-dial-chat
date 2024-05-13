import { FolderInterface, FolderType } from '@/chat/types/folder';
import { ExpectedConstants } from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';

export class FolderBuilder {
  private folder: FolderInterface;

  constructor() {
    this.folder = {
      id: GeneratorUtil.randomString(10),
      name: ExpectedConstants.newFolderTitle,
      type: FolderType.Chat,
      folderId: '',
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

  build(): FolderInterface {
    return this.folder;
  }
}

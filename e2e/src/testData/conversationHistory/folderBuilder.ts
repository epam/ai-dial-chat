import { FolderInterface, FolderType } from '@/types/folder';

import { ExpectedConstants } from '@/e2e/src/testData';
import { v4 as uuidv4 } from 'uuid';

export class FolderBuilder {
  private folder: FolderInterface;

  constructor() {
    this.folder = {
      id: uuidv4(),
      name: ExpectedConstants.newFolderTitle,
      type: 'chat',
    };
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

  build(): FolderInterface {
    return this.folder;
  }
}

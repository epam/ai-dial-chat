import { FileManager } from '@/src/ui/webElements';
import { BaseLayoutContainer } from '@/src/ui/webElements/baseLayoutContainer';
import { Header } from '@/src/ui/webElements/header';

export class FileManagerContainer extends BaseLayoutContainer<Header> {
  private fileManager!: FileManager;

  getHeader(): Header {
    if (!this.header) {
      this.header = new Header(this.page, this.rootLocator);
    }
    return this.header;
  }

  getFileManager(): FileManager {
    if (!this.fileManager) {
      this.fileManager = new FileManager(this.page, this.rootLocator);
    }
    return this.fileManager;
  }
}

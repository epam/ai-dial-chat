import { FilesManager } from '@/src/ui/webElements';
import { BaseLayoutContainer } from '@/src/ui/webElements/baseLayoutContainer';
import { Header } from '@/src/ui/webElements/header';

export class FilesManagerContainer extends BaseLayoutContainer<Header> {
  private filesManager!: FilesManager;

  getHeader(): Header {
    if (!this.header) {
      this.header = new Header(this.page, this.rootLocator);
    }
    return this.header;
  }

  getFilesManager(): FilesManager {
    if (!this.filesManager) {
      this.filesManager = new FilesManager(this.page, this.rootLocator);
    }
    return this.filesManager;
  }
}

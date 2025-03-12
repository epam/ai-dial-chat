import { Attributes } from '@/src/ui/domData';
import { FileSelectors } from '@/src/ui/selectors';
import { EntitiesTree } from '@/src/ui/webElements/entityTree';

export class PublishFilesTree extends EntitiesTree {
  public getFileDownloadIcon = (filename: string) =>
    this.getEntityByName(filename).locator(`~${FileSelectors.downloadIcon}`);

  public async getFileDownloadIUrl(filename: string) {
    const link = await this.getFileDownloadIcon(filename).getAttribute(
      Attributes.href,
    );
    return link !== null ? link : '';
  }
}

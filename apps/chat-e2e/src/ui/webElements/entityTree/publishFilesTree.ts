import { FileSelectors } from '@/src/ui/selectors';
import { EntitiesTree } from '@/src/ui/webElements/entityTree';

export class PublishFilesTree extends EntitiesTree {
  public getFileDownloadIcon = (filename: string) =>
    this.getEntityByName(filename).locator(`~${FileSelectors.downloadIcon}`);
}

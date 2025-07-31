import { FileSelectors, IconSelectors } from '@/src/ui/selectors';
import { PublishEntitiesTree } from '@/src/ui/webElements/entityTree/publishEntitiesTree';

export class PublishFilesTree extends PublishEntitiesTree {
  public getFileDownloadIcon = (filename: string) =>
    this.getEntityByName(filename).locator(`~${FileSelectors.downloadIcon}`);

  public fileIcon = (name: string) =>
    this.getTreeEntity(name, { exactMatch: true }).locator(
      IconSelectors.fileIcon,
    );
}

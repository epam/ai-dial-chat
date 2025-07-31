import { PublishEntityAssertion } from '@/src/assertions';
import { CheckboxState, ElementState, TreeEntity } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { PublishFilesTree } from '@/src/ui/webElements/entityTree/publishFilesTree';

export class PublishFileAssertion<
  K extends PublishFilesTree,
> extends PublishEntityAssertion<K> {
  public async assertFileToPublish(
    file: TreeEntity,
    fileAttributes: {
      expectedState: ElementState;
      expectedColor?: string;
      expectedCheckboxState?: CheckboxState;
      expectedDownloadUrl?: string;
    },
  ) {
    await this.assertEntityToPublish(file, fileAttributes);
    if (fileAttributes.expectedState === 'visible') {
      await this.assertElementState(
        this.publishEntities.fileIcon(file.name),
        'visible',
      );
      await this.assertElementState(
        this.publishEntities.getFileDownloadIcon(file.name),
        'visible',
      );
      if (fileAttributes.expectedDownloadUrl) {
        await this.assertElementAttribute(
          this.publishEntities.getFileDownloadIcon(file.name),
          Attributes.href,
          fileAttributes.expectedDownloadUrl,
        );
      }
    }
  }
}

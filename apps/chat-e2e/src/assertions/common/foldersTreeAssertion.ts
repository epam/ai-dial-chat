import { BaseAssertion } from '@/src/assertions';
import { ElementState } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { FoldersTree } from '@/src/ui/webElements';

export class FoldersTreeAssertion extends BaseAssertion {
  private readonly foldersTree: FoldersTree;

  constructor(foldersTree: FoldersTree) {
    super();
    this.foldersTree = foldersTree;
  }

  public async assertFolderState(
    expectedState: ElementState,
    ...path: string[]
  ) {
    await this.assertElementState(
      this.foldersTree.folderByPath(...path),
      expectedState,
    );
  }

  public async assertFolderSelectedState(
    isSelected: boolean,
    ...path: string[]
  ) {
    await this.assertElementAttribute(
      this.foldersTree.folderGroupByPath(...path),
      Attributes.ariaSelected,
      String(isSelected),
    );
  }
}

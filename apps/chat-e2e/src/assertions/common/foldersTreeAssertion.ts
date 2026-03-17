import { BaseAssertion } from '@/src/assertions';
import {
  ElementCaretState,
  ElementState,
  ExpectedMessages,
} from '@/src/testData';
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
      expectedState === 'visible'
        ? ExpectedMessages.folderIsVisible
        : ExpectedMessages.folderIsNotVisible,
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
      isSelected
        ? ExpectedMessages.folderIsSelected
        : ExpectedMessages.folderIsNotSelected,
    );
  }

  public async assertFolderExpandedState(
    expectedCaretState: ElementCaretState,
    ...path: string[]
  ) {
    const expectedClass =
      expectedCaretState === 'expanded'
        ? new RegExp(Attributes.rotated90)
        : new RegExp(`^(?!.*${Attributes.rotated90}).+$`);
    await this.assertElementClass(
      this.foldersTree.folderByPathCaret(...path),
      expectedClass,
      expectedCaretState === 'expanded'
        ? ExpectedMessages.folderExpanded
        : ExpectedMessages.folderCollapsed,
    );
  }
}

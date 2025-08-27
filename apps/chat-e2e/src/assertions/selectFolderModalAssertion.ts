import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ExpectedMessages } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { SelectFolderModal } from '@/src/ui/webElements';

export class SelectFolderModalAssertion extends BaseAssertion {
  readonly selectFolderModal: SelectFolderModal;

  constructor(selectFolderModal: SelectFolderModal) {
    super();
    this.selectFolderModal = selectFolderModal;
  }

  public async assertSectionSelectedState(isSelected: boolean) {
    await super.assertElementAttribute(
      this.selectFolderModal.rootFolder,
      Attributes.ariaSelected,
      String(isSelected),
      ExpectedMessages.folderIsHighlighted,
    );
  }
}

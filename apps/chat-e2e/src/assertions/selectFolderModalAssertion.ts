import { ExpectedMessages } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { SelectFolderModal } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class SelectFolderModalAssertion {
  readonly selectFolderModal: SelectFolderModal;

  constructor(selectFolderModal: SelectFolderModal) {
    this.selectFolderModal = selectFolderModal;
  }

  public async assertSectionSelectedState(isSelected: boolean) {
    await expect
      .soft(
        this.selectFolderModal.rootFolder.getElementLocator(),
        ExpectedMessages.folderIsHighlighted,
      )
      .toHaveAttribute(Attributes.ariaSelected, String(isSelected));
  }
}

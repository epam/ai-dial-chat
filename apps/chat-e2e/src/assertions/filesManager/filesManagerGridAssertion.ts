import { BaseAssertion } from '@/src/assertions';
import { CheckboxState, ElementState, ExpectedMessages } from '@/src/testData';
import { FilesManagerGrid } from '@/src/ui/webElements';

export class FilesManagerGridAssertion extends BaseAssertion {
  private readonly filesManagerGrid: FilesManagerGrid;

  constructor(filesManagerGrid: FilesManagerGrid) {
    super();
    this.filesManagerGrid = filesManagerGrid;
  }

  public async assertGridRowByNameState(
    name: string,
    expectedState: ElementState,
  ) {
    await this.assertElementState(
      this.filesManagerGrid.gridRowByNameCell(name),
      expectedState,
      expectedState === 'visible'
        ? ExpectedMessages.gridRowIsVisible
        : ExpectedMessages.gridRowIsNotVisible,
    );
  }

  public async assertGridCheckboxByNameState(
    name: string,
    expectedState: CheckboxState,
  ) {
    await this.assertCheckboxState(
      this.filesManagerGrid.gridCheckboxByNameCell(name),
      expectedState,
    );
  }
}

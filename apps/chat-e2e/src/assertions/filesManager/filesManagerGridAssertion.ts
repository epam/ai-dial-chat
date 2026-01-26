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
    await this.filesManagerGrid.loadingIndicator.waitForState({
      state: 'hidden',
    });
    // check the row is hidden if there is no any data in the grid
    if (await this.filesManagerGrid.isVisible()) {
      // if the grid is not empty, go on top of the grid and look for the record
      await this.filesManagerGrid.goTop();
      // goToGridRowByNameCell throws exception if element is not found after scrolling through all pages
      try {
        const gridRowByNameLocator =
          await this.filesManagerGrid.goToGridRowByNameCell(name);
        await this.assertElementState(
          gridRowByNameLocator,
          expectedState,
          expectedState === 'visible'
            ? ExpectedMessages.gridRowIsVisible
            : ExpectedMessages.gridRowIsNotVisible,
        );
      } catch {
        // Element not found - assert this matches expected hidden state
        this.assertBooleanCondition(
          true,
          expectedState === 'hidden',
          ExpectedMessages.gridRowIsNotVisible,
        );
      }
    } else {
      this.assertBooleanCondition(
        true,
        expectedState !== 'visible',
        ExpectedMessages.gridRowIsNotVisible,
      );
    }
  }

  public async assertGridCheckboxByNameState(
    name: string,
    expectedState: CheckboxState,
  ) {
    await this.assertCheckboxState(
      await this.filesManagerGrid.gridCheckboxByNameCell(name),
      expectedState,
    );
  }

  public async assertGridRowColor(name: string, expectedColor: string) {
    await this.filesManagerGrid.goTop();
    const gridRowByNameLocator =
      await this.filesManagerGrid.goToGridRowByNameCell(name);
    await this.assertElementColor(gridRowByNameLocator, expectedColor);
  }

  public async assertGridCheckboxColor(name: string, expectedColor: string) {
    await this.assertElementColor(
      await this.filesManagerGrid.gridCheckboxByNameCell(name),
      expectedColor,
    );
  }

  public async assertRenameInputError() {
    await this.assertElementState(
      this.filesManagerGrid.getRenameInputError(),
      'visible',
    );
  }
}

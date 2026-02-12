import { BaseAssertion } from '@/src/assertions';
import { CheckboxState, ElementState, ExpectedMessages } from '@/src/testData';
import { FileManagerGrid } from '@/src/ui/webElements';

export class FileManagerGridAssertion extends BaseAssertion {
  private readonly fileManagerGrid: FileManagerGrid;

  constructor(fileManagerGrid: FileManagerGrid) {
    super();
    this.fileManagerGrid = fileManagerGrid;
  }

  public async assertGridRowByNameState(
    name: string,
    expectedState: ElementState,
  ) {
    await this.fileManagerGrid.loadingIndicator.waitForState({
      state: 'hidden',
    });
    // check the row is hidden if there is no any data in the grid
    if (await this.fileManagerGrid.isVisible()) {
      // if the grid is not empty, go on top of the grid and look for the record
      await this.fileManagerGrid.goTop();
      // goToGridRowByNameCell throws exception if element is not found after scrolling through all pages
      try {
        const gridRowByNameLocator =
          await this.fileManagerGrid.goToGridRowByNameCell(name);
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
      await this.fileManagerGrid.gridCheckboxByNameCell(name),
      expectedState,
    );
  }

  public async assertGridRowColor(name: string, expectedColor: string) {
    await this.fileManagerGrid.goTop();
    const gridRowByNameLocator =
      await this.fileManagerGrid.goToGridRowByNameCell(name);
    await this.assertElementColor(gridRowByNameLocator, expectedColor);
  }

  public async assertGridCheckboxColor(name: string, expectedColor: string) {
    await this.assertElementColor(
      await this.fileManagerGrid.gridCheckboxByNameCell(name),
      expectedColor,
    );
  }

  public async assertRenameInputError(
    name: string,
    expectedState: ElementState = 'visible',
  ) {
    await this.assertElementState(
      this.fileManagerGrid.getRenameInputError(name),
      expectedState,
    );
  }

  public async assertRenameInputState(
    value: string,
    expectedState: ElementState,
  ) {
    await this.assertElementState(
      this.fileManagerGrid.getRenameInput(value),
      expectedState,
    );
  }
}

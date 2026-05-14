import { BaseAssertion } from '@/src/assertions';
import {
  CheckboxState,
  ElementActionabilityState,
  ElementState,
  ExpectedMessages,
} from '@/src/testData';
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

  public async assertGridCheckboxByNameActionabilityState(
    name: string,
    expectedState: ElementActionabilityState,
  ) {
    const checkbox = await this.fileManagerGrid.gridCheckboxByNameCell(name);
    await this.assertElementActionabilityState(
      checkbox.checkboxInput,
      expectedState,
    );
  }

  public async assertGridCheckboxByNameState(
    name: string,
    expectedState: CheckboxState,
  ) {
    const checkbox = await this.fileManagerGrid.gridCheckboxByNameCell(name);
    await this.assertCheckboxState(checkbox.checkboxInput, expectedState);
  }

  public async assertGridRowBackgroundColor(
    name: string,
    expectedColor: string,
  ) {
    await this.fileManagerGrid.goTop();
    const gridRowByNameLocator =
      await this.fileManagerGrid.goToGridRowByNameCell(name);
    await this.assertElementBackgroundColors(
      gridRowByNameLocator,
      expectedColor,
    );
  }

  public async assertGridCheckboxColor(name: string, expectedColor: string) {
    await this.assertElementColor(
      await this.fileManagerGrid.gridCheckboxByNameCell(name),
      expectedColor,
    );
  }

  public async assertGridCheckboxBorderColors(
    name: string,
    expectedColor: string,
  ) {
    await this.assertElementBorderColors(
      await this.fileManagerGrid.gridCheckboxByNameCell(name),
      expectedColor,
    );
  }

  public async assertInputError(
    expectedState: ElementState = 'visible',
    name?: string,
  ) {
    const locator = name
      ? this.fileManagerGrid.getRowInputError(name)
      : this.fileManagerGrid.gridNameCellInput.alertIcon;
    await this.assertElementState(
      locator,
      expectedState,
      ExpectedMessages.errorIconIsShown,
    );
  }

  public async assertGridNameCellInputState(expectedState: ElementState) {
    await this.assertElementState(
      this.fileManagerGrid.gridNameCellInput,
      expectedState,
    );
  }

  public async assertGridNameCellInputValue(expectedValue: string) {
    await this.assertInputValue(
      this.fileManagerGrid.gridNameCellInput.inputField,
      expectedValue,
    );
  }

  public async assertGridFileSharedState(
    name: string,
    expectedState: ElementState,
  ) {
    const sharedIconLocator =
      await this.fileManagerGrid.gridSharedFileIconByNameCell(name);
    await this.assertElementState(
      sharedIconLocator,
      expectedState,
      ExpectedMessages.fileIsShared,
    );
  }

  public async assertGridFileSharedIconColor(
    name: string,
    expectedColor: string,
  ) {
    const sharedIconLocator =
      await this.fileManagerGrid.gridSharedFileIconByNameCell(name);
    await this.assertElementColor(
      sharedIconLocator,
      expectedColor,
      ExpectedMessages.sharedIconColorIsValid,
    );
  }

  public async assertGridFileIconClass(
    name: string,
    expectedClass: string | RegExp,
  ) {
    const svgLocator =
      await this.fileManagerGrid.gridFileIconSvgByNameCell(name);
    const pattern =
      typeof expectedClass === 'string'
        ? new RegExp(expectedClass)
        : expectedClass;
    await this.assertElementClass(svgLocator, pattern);
  }

  public async assertGridFileIconClassDuringRename(
    expectedClass: string | RegExp,
  ) {
    const svgLocator = this.fileManagerGrid.getRenameRowFileIconSvg();
    const pattern =
      typeof expectedClass === 'string'
        ? new RegExp(expectedClass)
        : expectedClass;
    await this.assertElementClass(svgLocator, pattern);
  }
}

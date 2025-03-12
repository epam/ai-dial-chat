import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ElementState, ExpectedMessages } from '@/src/testData';
import { Attributes, Overflow, Styles } from '@/src/ui/domData';
import { VariableModalDialog } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class VariableModalAssertion extends BaseAssertion {
  readonly variableModalDialog: VariableModalDialog;

  constructor(variableModalDialog: VariableModalDialog) {
    super();
    this.variableModalDialog = variableModalDialog;
  }

  public async assertVariableModalState(expectedState: ElementState) {
    expectedState === 'visible'
      ? await expect
          .soft(
            this.variableModalDialog.getElementLocator(),
            ExpectedMessages.modalWindowIsOpened,
          )
          .toBeVisible()
      : await expect
          .soft(
            this.variableModalDialog.getElementLocator(),
            ExpectedMessages.modalWindowIsClosed,
          )
          .toBeHidden();
  }

  public async assertHorizontalScrollState(expectedState: ElementState) {
    const hasHorizontalScroll =
      await this.variableModalDialog.isElementWidthTruncated();
    expectedState === 'visible'
      ? expect
          .soft(hasHorizontalScroll, ExpectedMessages.horizontalScrollIsVisible)
          .toBeTruthy()
      : expect
          .soft(
            hasHorizontalScroll,
            ExpectedMessages.horizontalScrollIsNotVisible,
          )
          .toBeFalsy();
  }

  public async assertPromptName(expectedValue: string) {
    expect
      .soft(
        await this.variableModalDialog.name.getElementInnerContent(),
        ExpectedMessages.fieldValueIsValid,
      )
      .toBe(expectedValue);
  }

  public async assertPromptDescription(expectedValue: string) {
    expect
      .soft(
        await this.variableModalDialog.description.getElementInnerContent(),
        ExpectedMessages.fieldValueIsValid,
      )
      .toBe(expectedValue);
  }

  public async assertPromptVariableLabel(varLabel: string) {
    const label = this.variableModalDialog.getPromptVariableByLabel(varLabel);
    await expect.soft(label, ExpectedMessages.fieldLabelIsValid).toBeVisible();
  }

  public async assertPromptVariableLabelRequired(varLabel: string) {
    const varLabelAsterisk =
      this.variableModalDialog.getPromptVariableLabelAsterisk(varLabel);
    await expect
      .soft(varLabelAsterisk, ExpectedMessages.fieldIsRequired)
      .toHaveText('*');
  }

  public async assertPromptVariableValue(
    varLabel: string,
    expectedValue: string,
  ) {
    const varValue = this.variableModalDialog.getPromptVariableValue(varLabel);
    await expect
      .soft(varValue, ExpectedMessages.fieldValueIsValid)
      .toHaveText(expectedValue);
  }

  public async assertPromptVariablePlaceholder(
    varLabel: string,
    expectedPlaceholder: string,
  ) {
    const varValue = this.variableModalDialog.getPromptVariableValue(varLabel);
    await expect
      .soft(varValue, ExpectedMessages.filedPlaceholderIsValid)
      .toHaveAttribute(Attributes.placeholder, expectedPlaceholder);
  }

  public async assertPromptVariableBordersColor(
    varLabel: string,
    expectedColor: string,
  ) {
    const varFieldBordersColors = await this.variableModalDialog
      .getPromptVariableValueElement(varLabel)
      .getAllBorderColors();
    Object.values(varFieldBordersColors).forEach((borders) => {
      borders.forEach((borderColor) => {
        expect
          .soft(borderColor, ExpectedMessages.fieldBordersColorIsValid)
          .toBe(expectedColor);
      });
    });
  }

  public async assertPromptVariableBottomMessage(
    varLabel: string,
    expectedMessage: string,
  ) {
    const varMessage = await this.variableModalDialog
      .getPromptVariableBottomMessage(varLabel)
      .getElementInnerContent();
    expect
      .soft(varMessage, ExpectedMessages.fieldMessageIsValid)
      .toBe(expectedMessage);
  }

  public async assertPromptVariableBottomMessageColor(
    varLabel: string,
    expectedColor: string,
  ) {
    const varMessageColor = await this.variableModalDialog
      .getPromptVariableBottomMessage(varLabel)
      .getComputedStyleProperty(Styles.color);
    expect
      .soft(varMessageColor[0], ExpectedMessages.fieldMessageColorIsValid)
      .toBe(expectedColor);
  }

  public async assertPromptNameStyle() {
    const nameClass = await this.variableModalDialog.name.getAttribute(
      Attributes.class,
    );
    expect
      .soft(nameClass, ExpectedMessages.promptNameIsTruncated)
      .toContain(Styles.truncate);
    expect
      .soft(nameClass, ExpectedMessages.promptNameIsTruncated)
      .toContain(Styles.whitespacePre);
    expect
      .soft(nameClass, ExpectedMessages.elementFontIsValid)
      .toContain(Styles.fontBold);
  }

  public async assertPromptDescriptionStyle() {
    const descriptionClass =
      await this.variableModalDialog.description.getAttribute(Attributes.class);
    expect
      .soft(descriptionClass, ExpectedMessages.promptDescriptionIsFullyVisible)
      .toContain(Styles.whitespacePreWrap);
    expect
      .soft(descriptionClass, ExpectedMessages.elementFontIsValid)
      .toContain(Styles.italic);
  }

  public async assertPromptVariableLabelStyle(varLabel: string) {
    const label = this.variableModalDialog.getPromptVariableLabel(varLabel);
    expect
      .soft(
        await label.getAttribute(Attributes.class),
        ExpectedMessages.promptVarLabelIsFullyVisible,
      )
      .toContain(Styles.breakAll);
  }

  public async assertPromptVariablePlaceholderStyle(varLabel: string) {
    const placeholderOverflow = await this.variableModalDialog
      .getPromptVariableValueElement(varLabel)
      .getComputedStyleProperty(Styles.overflow_wrap);
    expect
      .soft(
        placeholderOverflow[0],
        ExpectedMessages.promptVarPlaceholderIsFullyVisible,
      )
      .toBe(Overflow.breakWord);
  }
}

import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ElementState, ExpectedMessages } from '@/src/testData';
import { Cursors, ThemeColorAttributes } from '@/src/ui/domData';
import { BaseAppEditorHeader, BaseElement } from '@/src/ui/webElements';
import { ThemesUtil } from '@/src/utils/themesUtil';

export class AppEditorHeaderAssertion extends BaseAssertion {
  readonly appEditorHeader: BaseAppEditorHeader;

  constructor(appEditorHeader: BaseAppEditorHeader) {
    super();
    this.appEditorHeader = appEditorHeader;
  }

  /**
   * Asserts the visibility and enabled state of a specific step link.
   * @param step The title of the step (e.g., "General info").
   * @param expectedState The expected visibility state ('visible' or 'hidden').
   * @param expectedCursor The expected cursor value.
   */
  public async assertStepState(
    step: BaseElement | string,
    expectedState: ElementState,
    expectedCursor: Cursors,
  ) {
    const stepLocator = this.getStepLocator(step);
    await this.assertElementState(
      stepLocator,
      expectedState,
      `Step "${stepLocator}" should be ${expectedState}`,
    );
    await this.assertElementCursor(stepLocator, expectedCursor);
    const expectedColorAttributes = ThemeColorAttributes.textPrimary;
    await this.assertElementColor(
      stepLocator,
      ThemesUtil.getRgbColorByKey(expectedColorAttributes),
    );
  }

  /**
   * Asserts whether a specific step is currently selected based on its icon.
   *   * @param step The title of the step (string) or the BaseElement representing the step link.
   *   * @param isSelected Expected selection state (true for selected, false for not selected).
   */
  public async assertStepIsSelected(
    step: BaseElement | string,
    isSelected: boolean,
  ) {
    const stepLocator = this.getStepLocator(step);
    if (isSelected) {
      await this.assertElementState(
        this.appEditorHeader.selectedIcon(stepLocator),
        'visible',
        `Step "${stepLocator}" should have selected icon`,
      );
      await this.assertElementState(
        this.appEditorHeader.notSelectedIcon(stepLocator),
        'hidden',
        `Step "${stepLocator}" should NOT have not-selected icon`,
      );
    } else {
      await this.assertElementState(
        this.appEditorHeader.selectedIcon(stepLocator),
        'hidden',
        `Step "${stepLocator}" should NOT have selected icon`,
      );
      await this.assertElementState(
        this.appEditorHeader.notSelectedIcon(stepLocator),
        'visible',
        `Step "${stepLocator}" should have not-selected icon`,
      );
    }
  }

  public async assertSelectedFilledPointIconState(
    step: BaseElement | string,
    expectedState: ElementState,
  ) {
    const stepLocator = this.getStepLocator(step);
    const iconElement =
      this.appEditorHeader.selectedFilledPointIcon(stepLocator);
    await this.assertElementState(iconElement, expectedState);
    await this.assertElementColor(
      iconElement,
      ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
    );
  }

  public async assertNotSelectedPointIconState(
    step: BaseElement | string,
    expectedState: ElementState,
  ) {
    const stepLocator = this.getStepLocator(step);
    const iconElement = this.appEditorHeader.notSelectedPointIcon(stepLocator);
    await this.assertElementState(iconElement, expectedState);
    await this.assertElementColor(
      iconElement,
      ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textSecondary),
    );
  }

  public async assertNotSelectedCheckedCircleIconState(
    step: BaseElement | string,
    expectedState: ElementState,
  ) {
    const stepLocator = this.getStepLocator(step);
    const iconElement =
      this.appEditorHeader.notSelectedCheckedCircleIcon(stepLocator);
    await this.assertElementState(iconElement, expectedState);
    await this.assertElementColor(
      iconElement,
      ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
    );
  }

  /**
   * Asserts the text content of the main action title (e.g., "Add custom app", "Edit custom app").
   * @param expectedTitle The expected title text.
   */
  public async assertActionTitle(expectedTitle: string) {
    await this.assertElementText(
      this.appEditorHeader.actionAndApplicationTypeTitle,
      expectedTitle,
      ExpectedMessages.headerTitleIsValid, // Or a more specific message
    );
  }

  private getStepLocator(step: BaseElement | string) {
    return typeof step === 'string'
      ? this.appEditorHeader.getStepByTitle(step)
      : step;
  }
}

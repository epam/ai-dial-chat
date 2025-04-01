import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import {
  ElementActionabilityState,
  ElementState,
  ExpectedMessages,
} from '@/src/testData';
import { AppEditorHeader, BaseElement } from '@/src/ui/webElements';

export class AppEditorHeaderAssertion extends BaseAssertion {
  readonly appEditorHeader: AppEditorHeader;

  constructor(appEditorHeader: AppEditorHeader) {
    super();
    this.appEditorHeader = appEditorHeader;
  }

  /**
   * Asserts the visibility and enabled state of a specific step link.
   * @param stepTitle The title of the step (e.g., "General info").
   * @param expectedState The expected visibility state ('visible' or 'hidden').
   * @param expectedActionability The expected actionability state ('enabled' or 'disabled').
   */
  public async assertStepState(
    step: BaseElement | string,
    expectedState: ElementState,
    expectedActionability: ElementActionabilityState = 'enabled', // Default to enabled
  ) {
    const stepLocator =
      typeof step === 'string'
        ? this.appEditorHeader.getStepByTitle(step)
        : step;
    await this.assertElementState(
      stepLocator,
      expectedState,
      `Step "${stepLocator}" should be ${expectedState}`,
    );
    if (expectedState === 'visible') {
      await this.assertElementActionabilityState(
        stepLocator,
        expectedActionability,
        `Step "${stepLocator}" should be ${expectedActionability}`,
      );
    }
  }

  /**
   * Asserts whether a specific step is currently selected based on its icon.
   *   * @param step The title of the step (string) or the BaseElement representing the step link.
   *   * @param isCompleted Expected selection state (true for selected, false for not selected).
   */
  public async assertStepIsCompleted(
    step: BaseElement | string,
    isCompleted: boolean,
  ) {
    const stepLocator =
      typeof step === 'string'
        ? this.appEditorHeader.getStepByTitle(step)
        : step;

    if (isCompleted) {
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
}

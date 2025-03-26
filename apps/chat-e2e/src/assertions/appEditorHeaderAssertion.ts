// src/assertions/appEditorHeaderAssertion.ts
import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import {
  ElementActionabilityState,
  ElementState,
  ExpectedMessages,
} from '@/src/testData';
import { ApplicationEditorHeader } from '@/src/ui/selectors';
// Assuming selectors are here
import { AppEditorHeader } from '@/src/ui/webElements';

// Import the web element

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
    stepTitle: string,
    expectedState: ElementState,
    expectedActionability: ElementActionabilityState = 'enabled', // Default to enabled
  ) {
    const stepLocator = await this.appEditorHeader.getStepByTitle(stepTitle);
    await this.assertElementState(
      stepLocator,
      expectedState,
      `Step "${stepTitle}" should be ${expectedState}`,
    );
    if (expectedState === 'visible') {
      await this.assertElementActionabilityState(
        stepLocator,
        expectedActionability,
      );
    }
  }

  /**
   * Asserts whether a specific step is currently selected based on its icon.
   * @param stepTitle The title of the step (e.g., "General info").
   * @param isSelected Expected selection state (true for selected, false for not selected).
   */
  public async assertStepIsSelected(stepTitle: string, isSelected: boolean) {
    const stepLocator = this.appEditorHeader
      .getStepByTitle(stepTitle)
      .getElementLocator();
    const selectedIconLocator = stepLocator.locator(
      ApplicationEditorHeader.selectedStepIcon,
    );
    const notSelectedIconLocator = stepLocator.locator(
      ApplicationEditorHeader.notSelectedStepIcon,
    );

    if (isSelected) {
      await this.assertElementState(
        selectedIconLocator,
        'visible',
        `Step "${stepTitle}" should have selected icon`,
      );
      await this.assertElementState(
        notSelectedIconLocator,
        'hidden',
        `Step "${stepTitle}" should NOT have not-selected icon`,
      );
    } else {
      await this.assertElementState(
        selectedIconLocator,
        'hidden',
        `Step "${stepTitle}" should NOT have selected icon`,
      );
      await this.assertElementState(
        notSelectedIconLocator,
        'visible',
        `Step "${stepTitle}" should have not-selected icon`,
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

import { ConfirmationPopup } from './confirmationPopup';

import { FileConflictResolutionSelectors } from '@/src/ui/selectors';
import { Locator, Page } from '@playwright/test';

export class FileConflictResolutionPopup extends ConfirmationPopup {
  constructor(page: Page) {
    super(page, 'Confirm');
  }

  getSingleFileRadio(
    value:
      | typeof FileConflictResolutionSelectors.replace
      | typeof FileConflictResolutionSelectors.duplicate,
  ): Locator {
    return this.rootLocator.locator(
      FileConflictResolutionSelectors.singleFileRadio(value),
    );
  }

  getMultipleFilesRadio(
    value:
      | typeof FileConflictResolutionSelectors.replaceAll
      | typeof FileConflictResolutionSelectors.duplicateAll
      | typeof FileConflictResolutionSelectors.decideForEach,
  ): Locator {
    return this.rootLocator.locator(
      FileConflictResolutionSelectors.multipleFilesRadio(value),
    );
  }

  async selectSingleFileAction(
    value:
      | typeof FileConflictResolutionSelectors.replace
      | typeof FileConflictResolutionSelectors.duplicate,
  ) {
    await this.rootLocator
      .locator(FileConflictResolutionSelectors.radioLabel(value))
      .click();
  }

  async selectMultipleFilesStrategy(
    value:
      | typeof FileConflictResolutionSelectors.replaceAll
      | typeof FileConflictResolutionSelectors.duplicateAll
      | typeof FileConflictResolutionSelectors.decideForEach,
  ) {
    await this.rootLocator
      .locator(FileConflictResolutionSelectors.radioLabel(value))
      .click();
  }
}

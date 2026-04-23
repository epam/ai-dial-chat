import { ConfirmationPopup } from './confirmationPopup';

import { Tags } from '@/src/ui/domData';
import { Locator, Page } from '@playwright/test';

//TODO replace all strings with proper values from specific class
// TODO Probably create a method to select any radiobutton with specific text close to it
export class FileConflictResolutionPopup extends ConfirmationPopup {
  constructor(page: Page) {
    super(page, 'Confirm');
  }

  getSingleFileRadio(value: 'replace' | 'duplicate'): Locator {
    return this.rootLocator.locator(
      `${Tags.input}[type="radio"][name="single-file-conflict"][value="${value}"]`,
    );
  }

  getMultipleFilesRadio(
    value: 'replaceAll' | 'duplicateAll' | 'decideForEach',
  ): Locator {
    return this.rootLocator.locator(
      `${Tags.input}[type="radio"][name="multiple-files-conflict"][value="${value}"]`,
    );
  }

  async selectSingleFileAction(value: 'replace' | 'duplicate') {
    await this.rootLocator.locator(`${Tags.label}[for="${value}"]`).click();
  }

  async selectMultipleFilesStrategy(
    value: 'replaceAll' | 'duplicateAll' | 'decideForEach',
  ) {
    await this.rootLocator.locator(`${Tags.label}[for="${value}"]`).click();
  }
}

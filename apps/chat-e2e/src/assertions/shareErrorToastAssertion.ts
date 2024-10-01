import { ExpectedConstants, ExpectedMessages } from '@/src/testData';
import { expect } from '@playwright/test';

export class ShareErrorToastAssertion {
  public async assertSharingWithAttachmentNotFromAllFilesFailed(
    errorMessage: string | null,
  ) {
    expect
      .soft(
        errorMessage,
        ExpectedMessages.sharingWithAttachmentNotFromAllFilesFailed,
      )
      .toBe(ExpectedConstants.sharingWithAttachmentNotFromAllFilesErrorMessage);
  }
}

import { ExpectedMessages } from '@/src/testData';
// Import other types if needed
import { Toast } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class ToastAssertion {
  readonly toast: Toast;

  constructor(toast: Toast) {
    this.toast = toast;
  }

  public async assertToastIsVisible() {
    await expect
      .soft(this.toast.getElementLocator(), ExpectedMessages.errorToastIsShown)
      .toBeVisible();
  }

  public async assertToastIsHidden() {
    await expect
      .soft(
        this.toast.getElementLocator(),
        ExpectedMessages.noErrorToastIsShown,
      )
      .toBeHidden();
  }

  public async assertToastMessage(
    expectedMessage: string,
    messageType: ExpectedMessages,
  ) {
    const errorMessage = await this.toast.getElementContent();
    expect.soft(errorMessage, messageType).toBe(expectedMessage);
  }
}

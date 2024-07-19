import { ExpectedMessages } from '@/src/testData'; // Import other types if needed
import { ErrorToast } from '@/src/ui/webElements';
import { expect } from '@playwright/test';


export class ErrorToastAssertion {
    readonly errorToast: ErrorToast;
  
    constructor(errorToast: ErrorToast) {
      this.errorToast = errorToast;
    }

    public async assertToastIsVisible() {
        await expect.soft(this.errorToast.getElementLocator(), ExpectedMessages.errorToastIsShown)
          .toBeVisible();
      }

      public async assertToastIsHidden() {
        await expect.soft(this.errorToast.getElementLocator(), ExpectedMessages.noErrorToastIsShown)
          .toBeHidden();
      }  

      public async assertToastMessage(expectedMessage: string, messageType: ExpectedMessages) { 
        const errorMessage = await this.errorToast.getElementContent();
        expect
          .soft(errorMessage, messageType)
          .toBe(expectedMessage); 
      }
  }
import { ExpectedMessages } from '@/src/testData';
import { ChangePath } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class ChangePathAssertion {
  readonly changePath: ChangePath;

  constructor(changePath: ChangePath) {
    this.changePath = changePath;
  }

  public async assertPath(expectedPath: string) {
    const actualPath = this.changePath.path.getElementLocator();
    await expect
      .soft(actualPath, ExpectedMessages.fieldValueIsValid)
      .toHaveText(expectedPath);
  }
}

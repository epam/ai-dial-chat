import { ElementState, ExpectedMessages } from '@/src/testData';
import { Footer } from '@/src/ui/webElements/footer';
import { expect } from '@playwright/test';

export class FooterAssertion {
  readonly footer: Footer;

  constructor(footer: Footer) {
    this.footer = footer;
  }

  public async assertFooterState(expectedState: ElementState) {
    const footer = this.footer.getElementLocator();
    expectedState === 'visible'
      ? await expect
          .soft(footer, ExpectedMessages.footerIsVisible)
          .toBeVisible()
      : await expect
          .soft(footer, ExpectedMessages.footerIsNotVisible)
          .toBeHidden();
  }

  public async assertFooterContentLength() {
    expect
      .soft(
        await this.footer.getElementInnerContent().then((c) => c.length),
        ExpectedMessages.footerContentIsNotEmpty,
      )
      .toBeGreaterThan(0);
  }
}

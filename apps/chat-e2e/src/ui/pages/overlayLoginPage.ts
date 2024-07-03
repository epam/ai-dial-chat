import { BasePage } from '@/src/ui/pages/basePage';
import { overlayFrame } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';

export class OverlayLoginPage extends BasePage {
  public loginButton = new BaseElement(
    this.page,
    '',
    this.page.frameLocator(overlayFrame).getByText('Login'),
  );

  public async clickLoginButton() {
    const [newPage] = await Promise.all([
      this.page.context().waitForEvent('page'),
      await this.loginButton.click(),
    ]);
    await newPage.waitForLoadState();
    return newPage;
  }
}

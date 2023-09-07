import { Page } from '@playwright/test';

export class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async openHomePage() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async reloadPage() {
    await this.page.reload();
    await this.page.waitForLoadState('networkidle');
  }
}

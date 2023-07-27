import { Page } from '@playwright/test';
import config from '../../../local.playwright.config'

export class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async openHomePage() {
    await this.page.goto(config.use!.baseURL!);
  }
}

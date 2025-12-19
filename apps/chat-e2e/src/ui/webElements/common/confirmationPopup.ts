import { Button, Popup } from '@/src/ui/webElements';
import { Page } from '@playwright/test';
import { Response } from 'playwright-core';

export class ConfirmationPopup extends Popup {
  private confirmButton: Button;

  constructor(page: Page, confirmButtonAreaLabel: string) {
    super(page);
    this.confirmButton = new Button(
      this.page,
      confirmButtonAreaLabel,
      this.rootLocator,
    );
  }

  getConfirmButton(): Button {
    return this.confirmButton;
  }

  public async confirm({
    triggeredHttpMethod = undefined,
    triggeredHttpHost = undefined,
  }: {
    triggeredHttpMethod?: 'PUT' | 'DELETE' | 'POST' | 'GET';
    triggeredHttpHost?: string;
  } = {}) {
    if (triggeredHttpMethod) {
      const predicate = (resp: Response) =>
        triggeredHttpHost
          ? resp.request().method() === triggeredHttpMethod &&
            resp.url().includes(triggeredHttpHost)
          : resp.request().method() === triggeredHttpMethod;
      const respPromise = this.page.waitForResponse(predicate);
      await this.confirmButton.click();
      return respPromise;
    }
    await this.confirmButton.click();
  }
}

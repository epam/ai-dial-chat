import { PopupSelectors } from '@/src/ui/selectors';
import { Button, Popup } from '@/src/ui/webElements';
import { Page } from '@playwright/test';
import { Response } from 'playwright-core';

export class ConfirmationPopup extends Popup {
  private confirmButton: Button;

  constructor(page: Page, confirmButtonAreaLabel: string) {
    super(page, PopupSelectors.popupLabelledContainer);
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
    expectedRequests = undefined,
  }: {
    triggeredHttpMethod?: 'PUT' | 'DELETE' | 'POST' | 'GET';
    triggeredHttpHost?: string;
    expectedRequests?: Map<string, string>;
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
    } else if (expectedRequests && expectedRequests.size > 0) {
      const responsePromises: Promise<unknown>[] = [];

      for (const [partialPath, method] of expectedRequests) {
        responsePromises.push(
          this.page.waitForResponse(
            (r) =>
              r.url().includes(partialPath) && r.request().method() === method,
          ),
        );
      }
      await this.confirmButton.click();
      await Promise.all(responsePromises);
    } else {
      await this.confirmButton.click();
    }
  }
}

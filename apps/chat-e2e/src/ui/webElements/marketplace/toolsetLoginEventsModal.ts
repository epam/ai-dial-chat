import { PopupSelectors } from '@/src/ui/selectors';
import { ToolsetLoginEventsModalSelectors } from '@/src/ui/selectors/marketplaceSelectors';
import { BaseElement, Button } from '@/src/ui/webElements';
import { Popup } from '@/src/ui/webElements/common/popup';
import { Page } from '@playwright/test';

// The "Toolset login required" modal shown in the App editor preview when the
// orchestration needs a logged-out toolset (ChatEventsModal/ToolsetLoginEvents).
// Several DialPopups may be open at once, so scope to the one holding the list.
export class ToolsetLoginEventsModal extends Popup {
  constructor(page: Page) {
    super(
      page,
      `${PopupSelectors.popupContainer}:has(${ToolsetLoginEventsModalSelectors.list})`,
    );
  }

  public list = this.getChildElementBySelector(
    ToolsetLoginEventsModalSelectors.list,
  );

  public rows = this.getChildElementBySelector(
    ToolsetLoginEventsModalSelectors.row,
  );

  public declineAllButton = new Button(
    this.page,
    ToolsetLoginEventsModalSelectors.declineAllButton,
    this.rootLocator,
  );

  public getRowByToolsetName(name: string): BaseElement {
    return this.createElementFromLocator(
      this.rows.getElementLocator().filter({ hasText: name }),
    );
  }

  public getLoginButton(name: string): Button {
    return new Button(
      this.page,
      ToolsetLoginEventsModalSelectors.loginButton,
      this.getRowByToolsetName(name).getElementLocator(),
    );
  }

  public getDeclineButton(name: string): Button {
    return new Button(
      this.page,
      ToolsetLoginEventsModalSelectors.declineButton,
      this.getRowByToolsetName(name).getElementLocator(),
    );
  }
}

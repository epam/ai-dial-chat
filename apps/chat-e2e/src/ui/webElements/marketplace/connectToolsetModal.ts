import {
  ConnectToolsetModalSelectors,
  PopupSelectors,
} from '@/src/ui/selectors';
import { Button } from '@/src/ui/webElements';
import { Popup } from '@/src/ui/webElements/common/popup';
import { Page } from '@playwright/test';

export class ConnectToolsetModal extends Popup {
  constructor(page: Page) {
    super(page, PopupSelectors.popupLabelledContainer);
  }

  public copyUrlButton = new Button(
    this.page,
    ConnectToolsetModalSelectors.copyUrlButton,
    this.rootLocator,
  );
}

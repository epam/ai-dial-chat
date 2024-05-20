import { ToastSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class ChatLoader extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ToastSelectors.chatLoader, parentLocator);
  }
}

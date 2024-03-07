import { ChatSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class ErrorToast extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.errorToast);
  }
}

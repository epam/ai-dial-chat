import { ToastSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class ChatNotFound extends BaseElement {
  constructor(page: Page) {
    super(page, ToastSelectors.conversationNotFound);
  }

  public async getChatNotFoundContent() {
    const allContent = await this.getElementsInnerContent();
    return allContent
      .join()
      .replaceAll(/\u00a0/g, '')
      .replaceAll('\n', '');
  }
}

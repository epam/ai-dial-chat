import { CompareSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { ModelSelector } from '@/src/ui/webElements/modelSelector';
import { Page } from '@playwright/test';

export class ConversationToCompare extends BaseElement {
  constructor(page: Page) {
    super(page, CompareSelectors.conversationToCompare);
  }

  private conversationSelector!: ModelSelector;
  public showAllConversationsCheckbox = this.getChildElementBySelector(
    CompareSelectors.showAllCheckbox,
  );

  getConversationSelector(): ModelSelector {
    if (!this.conversationSelector) {
      this.conversationSelector = new ModelSelector(
        this.page,
        this.rootLocator,
      );
    }
    return this.conversationSelector;
  }

  public async checkShowAllConversations() {
    if (await this.showAllConversationsCheckbox.isVisible()) {
      await this.showAllConversationsCheckbox.click();
    }
  }
}

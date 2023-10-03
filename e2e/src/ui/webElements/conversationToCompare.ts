import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { ModelSelector } from '@/e2e/src/ui/webElements/modelSelector';
import { Page } from '@playwright/test';

export class ConversationToCompare extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.conversationToCompare);
  }

  private conversationSelector!: ModelSelector;

  getConversationSelector(): ModelSelector {
    if (!this.conversationSelector) {
      this.conversationSelector = new ModelSelector(
        this.page,
        this.rootLocator,
      );
    }
    return this.conversationSelector;
  }
}

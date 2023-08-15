import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';
import { EntitySelector } from './entitySelector';

import { EntitySettings } from '@/e2e/src/ui/webElements/entitySettings';
import { Page } from '@playwright/test';

export class ConversationSettings extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.conversationSettingsSelector);
  }

  private talkToSelector!: EntitySelector;
  private entitySettings!: EntitySettings;

  getTalkToSelector(): EntitySelector {
    if (!this.talkToSelector) {
      this.talkToSelector = new EntitySelector(this.page);
    }
    return this.talkToSelector;
  }

  getEntitySettings(): EntitySettings {
    if (!this.entitySettings) {
      this.entitySettings = new EntitySettings(this.page);
    }
    return this.entitySettings;
  }
}

import { ChatSettingsSelectors, IconSelectors } from '../selectors';
import { BaseElement } from './baseElement';
import { EntitySelector } from './entitySelector';

import { EntitySettings } from '@/src/ui/webElements/entitySettings';
import { Locator, Page } from '@playwright/test';

export class ConversationSettings extends BaseElement {
  constructor(page: Page, parentLocator?: Locator, index?: number) {
    const elementLocator = new BaseElement(
      page,
      ChatSettingsSelectors.conversationSettingsModal,
      parentLocator,
    ).getNthElement(index ?? 1);
    super(page, '', elementLocator);
  }

  public cancelButton = this.getChildElementBySelector(
    IconSelectors.cancelIcon,
  );
  private talkToSelector!: EntitySelector;
  private entitySettings!: EntitySettings;

  getTalkToSelector(): EntitySelector {
    if (!this.talkToSelector) {
      this.talkToSelector = new EntitySelector(this.page, this.rootLocator);
    }
    return this.talkToSelector;
  }

  getEntitySettings(): EntitySettings {
    if (!this.entitySettings) {
      this.entitySettings = new EntitySettings(this.page, this.rootLocator);
    }
    return this.entitySettings;
  }
}

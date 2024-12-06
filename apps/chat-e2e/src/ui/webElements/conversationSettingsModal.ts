import { ChatSettingsModalSelectors, IconSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { AgentSettings } from '@/src/ui/webElements/agentSettings';
import { Locator, Page } from '@playwright/test';

export class ConversationSettingsModal extends BaseElement {
  constructor(page: Page, parentLocator?: Locator, index?: number) {
    const elementLocator = new BaseElement(
      page,
      ChatSettingsModalSelectors.conversationSettingsModal,
      parentLocator,
    ).getNthElement(index ?? 1);
    super(page, '', elementLocator);
  }

  public cancelButton = this.getChildElementBySelector(
    IconSelectors.cancelIcon,
  );
  public applyChangesButton = this.getChildElementBySelector(
    ChatSettingsModalSelectors.applyChanges,
  );
  private agentSettings!: AgentSettings;

  getAgentSettings(): AgentSettings {
    if (!this.agentSettings) {
      this.agentSettings = new AgentSettings(this.page, this.rootLocator);
    }
    return this.agentSettings;
  }
}

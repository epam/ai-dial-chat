import { ChatSettingsModalSelectors, IconSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { AgentSettings } from '@/src/ui/webElements/agentSettings';
import { Page } from '@playwright/test';

export class ConversationSettingsModal extends BaseElement {
  constructor(page: Page, index?: number) {
    const elementLocator = new BaseElement(
      page,
      ChatSettingsModalSelectors.conversationSettingsModal,
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

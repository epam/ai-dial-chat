import { ChatSettingsModalSelectors, IconSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { AgentSettings } from '@/src/ui/webElements/agentSettings';
import { Locator, Page } from '@playwright/test';

export class ConversationSettingsModal extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(
      page,
      ChatSettingsModalSelectors.conversationSettingsModal,
      parentLocator,
    );
  }

  public cancelButton = this.getChildElementBySelector(
    IconSelectors.cancelIcon,
  );
  public applyChangesButton = this.getChildElementBySelector(
    ChatSettingsModalSelectors.applyChanges,
  );
  private agentSettings!: AgentSettings;
  private leftAgentSettings!: AgentSettings;
  private rightAgentSettings!: AgentSettings;

  getAgentSettings(): AgentSettings {
    if (!this.agentSettings) {
      this.agentSettings = new AgentSettings(this.page, this.rootLocator);
    }
    return this.agentSettings;
  }

  getLeftAgentSettings(): AgentSettings {
    if (!this.leftAgentSettings) {
      this.leftAgentSettings = new AgentSettings(this.page, this.rootLocator);
    }
    return this.leftAgentSettings;
  }

  getRightAgentSettings(): AgentSettings {
    if (!this.rightAgentSettings) {
      this.rightAgentSettings = new AgentSettings(
        this.page,
        this.rootLocator,
        2,
      );
    }
    return this.rightAgentSettings;
  }
}

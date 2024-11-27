import { ChatSettingsSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Tags } from '@/src/ui/domData';
import { Locator, Page } from '@playwright/test';

export class AgentInfo extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSettingsSelectors.agentInfoContainer, parentLocator);
  }
  public agentInfo = this.getChildElementBySelector(
    ChatSettingsSelectors.agentInfo,
  );

  public agentDescription = this.getChildElementBySelector(
    ChatSettingsSelectors.agentDescription,
  );
  public agentIcon = this.getChildElementBySelector(Tags.img);

  async getAgentIcon() {
    await this.agentIcon.waitForState();
    return this.getElementIcon(this.rootLocator);
  }

  public async getAgentDescription() {
    if (await this.agentDescription.isVisible()) {
      return this.agentDescription.getElementInnerContent();
    }
    return undefined;
  }

  public async getAgentName() {
    return this.agentInfo
      .getElementLocator()
      .locator(Tags.span)
      .last()
      .textContent();
  }
}

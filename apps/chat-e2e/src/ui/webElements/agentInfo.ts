import { ChatSettingsSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Tags } from '@/src/ui/domData';
import { Locator, Page } from '@playwright/test';

export class AgentInfo extends BaseElement {
  constructor(page: Page, parentLocator: Locator, index?: number) {
    const elementLocator = new BaseElement(
      page,
      ChatSettingsSelectors.agentInfoContainer,
      parentLocator,
    ).getNthElement(index ?? 1);
    super(page, '', elementLocator);
  }
  public agentInfo = this.getChildElementBySelector(
    ChatSettingsSelectors.agentInfo,
  );
  public agentName = this.getChildElementBySelector(
    ChatSettingsSelectors.agentName,
  );
  public agentDescription = this.getChildElementBySelector(
    ChatSettingsSelectors.agentDescription,
  );
  public agentVersion = this.getChildElementBySelector(
    ChatSettingsSelectors.agentVersion,
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
}

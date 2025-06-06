import { ChatSettingsSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { Tags } from '@/src/ui/domData';
import { DropdownButtonMenu } from '@/src/ui/webElements/dropdownButtonMenu';
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

  public agentVersionsDropdownMenu!: DropdownButtonMenu;

  public getAgentVersionsDropdownMenu() {
    if (!this.agentVersionsDropdownMenu) {
      this.agentVersionsDropdownMenu = new DropdownButtonMenu(this.page);
    }
    return this.agentVersionsDropdownMenu;
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
  public agentVersionMenuTrigger = this.getChildElementBySelector(
    ChatSettingsSelectors.agentVersionMenuTrigger,
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

import { AgentAndToolsetModalSelector } from '@/src/ui/selectors';
import { AgentsBrowserModal } from '@/src/ui/webElements/agentsBrowserModal';
import { Button } from '@/src/ui/webElements/common/button';
import { Page } from '@playwright/test';

export class AgentAndToolsetSelectModal extends AgentsBrowserModal {
  constructor(page: Page) {
    super(page, AgentAndToolsetModalSelector.container);
  }

  public confirmButton = new Button(this.page, 'Confirm', this.rootLocator);

  public async selectEntityByName(name: string): Promise<void> {
    await this.getEntityByName(name).click();
  }
}

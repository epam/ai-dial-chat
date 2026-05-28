import { AgentAndToolsetModalSelector } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Button } from '@/src/ui/webElements/common/button';
import { Page } from '@playwright/test';

export class AgentAndToolsetSelectModal extends BaseElement {
  constructor(page: Page) {
    super(page, AgentAndToolsetModalSelector.container);
  }

  public searchInput = this.getChildElementBySelector(
    AgentAndToolsetModalSelector.searchInput,
  );
  public myWorkspaceTab = this.getChildElementBySelector(
    AgentAndToolsetModalSelector.myWorkspaceTab,
  );
  public marketplaceTab = this.getChildElementBySelector(
    AgentAndToolsetModalSelector.marketplaceTab,
  );

  public confirmButton = new Button(this.page, 'Confirm', this.rootLocator);
  public cancelButton = new Button(this.page, 'Cancel', this.rootLocator);
  public closeButton = new Button(this.page, 'Close dialog', this.rootLocator);

  public getEntityByName(name: string): BaseElement {
    return this.getChildElementBySelector(
      `${AgentAndToolsetModalSelector.entity}:has(${AgentAndToolsetModalSelector.entityName}:text-is("${name}"))`,
    );
  }

  public async selectEntityByName(name: string): Promise<void> {
    await this.getEntityByName(name).click();
  }
}

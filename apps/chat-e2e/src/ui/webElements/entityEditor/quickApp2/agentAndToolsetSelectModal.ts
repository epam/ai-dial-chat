import {
  AddQuickApp2SettingsFormSelector,
  AgentAndToolsetModalSelector,
} from '@/src/ui/selectors';
import { AgentsBrowserModal } from '@/src/ui/webElements/agentsBrowserModal';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Button } from '@/src/ui/webElements/common/button';
import { RegexUtil } from '@/src/utils';
import { Locator, Page } from '@playwright/test';

export class AgentAndToolsetSelectModal extends AgentsBrowserModal {
  constructor(page: Page) {
    super(page, AgentAndToolsetModalSelector.container);
  }

  public confirmButton = new Button(this.page, 'Confirm', this.rootLocator);

  public async selectEntityByName(name: string): Promise<void> {
    await this.getEntityByName(name).click();
  }

  // Search for each entity and pick it; useful for multiple selections.
  public async selectEntities(names: string[]): Promise<void> {
    for (const name of names) {
      await this.searchInput.fillInInput(name);
      await this.selectEntityByName(name);
    }
  }

  // Only the "Selected" section renders chips inside the modal,
  // so the field's chip selector is safe to reuse here.
  public selectedChips = this.getChildElementBySelector(
    AddQuickApp2SettingsFormSelector.agentChip,
  );

  public getSelectedChipByName(name: string): BaseElement {
    const chipNameWithText = this.page.locator(
      AddQuickApp2SettingsFormSelector.chipName,
      { hasText: new RegExp(`^\\s*${RegexUtil.escapeRegexChars(name)}\\s*$`) },
    );
    return this.createElementFromLocator(
      this.selectedChips.getElementLocator().filter({ has: chipNameWithText }),
    );
  }
}

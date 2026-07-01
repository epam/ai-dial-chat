import {
  AddQuickApp2SettingsFormSelector,
  AgentAndToolsetModalSelector,
} from '@/src/ui/selectors';
import { AgentsBrowserModal } from '@/src/ui/webElements/agentsBrowserModal';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Button } from '@/src/ui/webElements/common/button';
import { RegexUtil } from '@/src/utils';
import { Page } from '@playwright/test';

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

  // Only the "Selected" section renders chips inside the modal.
  public selectedChips = this.getChildElementBySelector(
    AddQuickApp2SettingsFormSelector.agentChip,
  );

  public getSelectedChipByName(name: string): BaseElement {
    // Only the "Selected" section renders chip-name; the overflow container adds
    // a hidden copy, so getElementLocatorByText's first match is the visible one.
    return this.createElementFromLocator(
      this.getChildElementBySelector(
        AddQuickApp2SettingsFormSelector.chipName,
      ).getElementLocatorByText(
        new RegExp(`^\\s*${RegexUtil.escapeRegexChars(name)}\\s*$`),
      ),
    );
  }
}

import {
  AddQuickApp2SettingsFormSelector,
  AgentAndToolsetModalSelector,
} from '@/src/ui/selectors';
import { AgentsBrowserModal } from '@/src/ui/webElements/agentsBrowserModal';
import { BaseElement } from '@/src/ui/webElements/baseElement';
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

  // Only the "Selected" section renders chips inside the modal,
  // so the field's chip selector is safe to reuse here.
  public selectedChips = this.getChildElementBySelector(
    AddQuickApp2SettingsFormSelector.agentChip,
  );

  public getSelectedChipByName(name: string): BaseElement {
    return this.getChildElementBySelector(
      `${AddQuickApp2SettingsFormSelector.agentChip}:has(${AddQuickApp2SettingsFormSelector.chipName}:text-is("${name}"))`,
    );
  }
}

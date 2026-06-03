import { AddQuickApp2SettingsFormSelector } from '@/src/ui/selectors';
import {
  BaseElement,
  Button,
  EntityEditorViewForm,
} from '@/src/ui/webElements';

export class QuickApp2EditorViewForm extends EntityEditorViewForm {
  public orchestratorSection = this.getChildElementBySelector(
    AddQuickApp2SettingsFormSelector.orchestratorSection,
  );
  public contextToolsSection = this.getChildElementBySelector(
    AddQuickApp2SettingsFormSelector.contextToolsSection,
  );
  public attachmentsSection = this.getChildElementBySelector(
    AddQuickApp2SettingsFormSelector.attachmentsSection,
  );
  public conversationStartersSection = this.getChildElementBySelector(
    AddQuickApp2SettingsFormSelector.conversationStartersSection,
  );

  // Context & Tools subsections
  public agentsAndToolsetsField =
    this.contextToolsSection.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.agentsAndToolsetsField,
    );
  public documentUrlsField = this.contextToolsSection.getChildElementBySelector(
    AddQuickApp2SettingsFormSelector.documentUrlsField,
  );
  public codeInterpreterField =
    this.contextToolsSection.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.codeInterpreterField,
    );
  public codeInterpreterToggle =
    this.codeInterpreterField.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.codeInterpreterToggle,
    );

  // Agents & Toolsets — view modes
  public agentsAndToolsetsMarketplaceView =
    this.agentsAndToolsetsField.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.agentsAndToolsetsMarketplaceView,
    );
  public agentsAndToolsetsJsonView =
    this.agentsAndToolsetsField.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.agentsAndToolsetsJsonView,
    );

  // Agents & Toolsets — controls inside marketplace view
  public noAgentsAndToolsetsPlaceholder =
    this.agentsAndToolsetsMarketplaceView.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.noAgentsAndToolsetsPlaceholder,
    );
  public agentsAndToolsetsList =
    this.agentsAndToolsetsMarketplaceView.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.agentsAndToolsetsList,
    );
  public addAgentsButton = new Button(
    this.page,
    AddQuickApp2SettingsFormSelector.addAgentsButtonLabel,
    this.agentsAndToolsetsMarketplaceView
      .getChildElementBySelector(
        AddQuickApp2SettingsFormSelector.addAgentsButtonContainer,
      )
      .getElementLocator(),
  );
  public agentsAndToolsetsJsonToggle =
    this.agentsAndToolsetsMarketplaceView.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.agentsAndToolsetsJsonToggle,
    );

  public getChipByName(name: string): BaseElement {
    return this.agentsAndToolsetsList.getChildElementBySelector(
      `${AddQuickApp2SettingsFormSelector.agentChip}:has(${AddQuickApp2SettingsFormSelector.chipName}:text-is("${name}"))`,
    );
  }

  public getChipVersionByName(name: string): BaseElement {
    return this.getChipByName(name).getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.chipVersion,
    );
  }

  public async clickChipByName(name: string): Promise<void> {
    await this.getChipByName(name).click();
  }

  public getChipRemoveButton(name: string): Button {
    return new Button(
      this.page,
      AddQuickApp2SettingsFormSelector.chipRemoveButtonLabel,
      this.getChipByName(name).getElementLocator(),
    );
  }

  public async removeChipByName(name: string): Promise<void> {
    await this.getChipRemoveButton(name).click();
  }

  public get allChips(): BaseElement {
    return this.agentsAndToolsetsList.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.agentChip,
    );
  }

  public get allChipNames(): BaseElement {
    return this.agentsAndToolsetsList.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.chipName,
    );
  }

  public async getAllChipNameTexts(): Promise<string[]> {
    return this.allChipNames.getElementLocator().allTextContents();
  }
}

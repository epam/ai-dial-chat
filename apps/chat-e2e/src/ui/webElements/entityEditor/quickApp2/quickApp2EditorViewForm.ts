import { AddQuickApp2SettingsFormSelector } from '@/src/ui/selectors';
import { EntityEditorViewForm } from '@/src/ui/webElements';

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
  public addAgentsButton =
    this.agentsAndToolsetsMarketplaceView.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.addAgentsButton,
    );
  public agentsAndToolsetsJsonToggle =
    this.agentsAndToolsetsMarketplaceView.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.agentsAndToolsetsJsonToggle,
    );
}

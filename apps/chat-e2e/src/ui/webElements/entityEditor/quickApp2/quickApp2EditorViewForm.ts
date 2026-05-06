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
  public agentsAndToolsetsField = this.contextToolsSection.getChildElementBySelector(
    'div:has(> label:has-text("Agents & Toolsets"))',
  );
  public noAgentsAndToolsetsPlaceholder =
    this.agentsAndToolsetsField.getChildElementBySelector(
      ':text("No Agents & Toolsets added")',
    );
  public addAgentsButton = this.agentsAndToolsetsField.getChildElementBySelector(
    'button:has-text("Add")',
  );
  public jsonToggle =
    this.agentsAndToolsetsField.getChildElementBySelector(':text("JSON")');
}

import { AddQuickApp2SettingsFormSelector } from '@/src/ui/selectors';
import {
  BaseElement,
  Button,
  EntityEditorViewForm,
} from '@/src/ui/webElements';
import { RegexUtil } from '@/src/utils';
import { Locator } from '@playwright/test';

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

  // Chip child (name/version) matching the exact text, used as a `filter({ has })`
  // argument. It must be page-rooted (the `marketplaceEntities.getEntity` idiom):
  // a `this`-scoped locator carries the form ancestor chain and never matches
  // once Playwright re-roots the `has` argument under a chip.
  private chipChildWithText(selector: string, text: string): Locator {
    return new BaseElement(this.page, selector).getElementLocator().filter({
      hasText: new RegExp(`^\\s*${RegexUtil.escapeRegexChars(text)}\\s*$`),
    });
  }

  private chipsContainer(): Locator {
    return this.agentsAndToolsetsList
      .getChildElementBySelector(AddQuickApp2SettingsFormSelector.agentChip)
      .getElementLocator();
  }

  public getChipByName(name: string): BaseElement {
    return this.createElementFromLocator(
      this.chipsContainer().filter({
        has: this.chipChildWithText(
          AddQuickApp2SettingsFormSelector.chipName,
          name,
        ),
      }),
    );
  }

  public getChipVersionByName(name: string): BaseElement {
    return this.getChipByName(name).getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.chipVersion,
    );
  }

  // For agents with several versions added — one chip per version.
  public getChipByNameAndVersion(name: string, version: string): BaseElement {
    return this.createElementFromLocator(
      this.chipsContainer()
        .filter({
          has: this.chipChildWithText(
            AddQuickApp2SettingsFormSelector.chipName,
            name,
          ),
        })
        .filter({
          has: this.chipChildWithText(
            AddQuickApp2SettingsFormSelector.chipVersion,
            version,
          ),
        }),
    );
  }

  public async clickChipByName(name: string): Promise<void> {
    await this.getChipByName(name).click();
  }

  private chipRemoveButton(chip: BaseElement): Button {
    return new Button(
      this.page,
      AddQuickApp2SettingsFormSelector.chipRemoveButtonLabel,
      chip.getElementLocator(),
    );
  }

  public getChipRemoveButton(name: string): Button {
    return this.chipRemoveButton(this.getChipByName(name));
  }

  public async removeChipByName(name: string): Promise<void> {
    await this.getChipRemoveButton(name).click();
  }

  public async removeChipByNameAndVersion(
    name: string,
    version: string,
  ): Promise<void> {
    await this.chipRemoveButton(
      this.getChipByNameAndVersion(name, version),
    ).click();
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

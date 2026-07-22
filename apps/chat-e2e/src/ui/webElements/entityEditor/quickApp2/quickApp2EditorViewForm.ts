import { Tags } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { AddQuickApp2SettingsFormSelector } from '@/src/ui/selectors';
import {
  BaseElement,
  Button,
  Combobox,
  EntityEditorViewForm,
} from '@/src/ui/webElements';
import { RegexUtil } from '@/src/utils';
import { Locator } from '@playwright/test';

// Delay between characters when typing MIME types into the combobox.
const keyEnteringDelay = 30;

export class QuickApp2EditorViewForm extends EntityEditorViewForm {
  public orchestratorSection = this.getChildElementBySelector(
    AddQuickApp2SettingsFormSelector.orchestratorSection,
  );

  // Orchestrator model card + its name + the "Change" button that opens the picker
  public orchestratorModel = this.orchestratorSection.getChildElementBySelector(
    AddQuickApp2SettingsFormSelector.orchestratorModel,
  );
  public orchestratorModelName =
    this.orchestratorModel.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.orchestratorModelName,
    );
  public changeModelButton = new Button(
    this.page,
    AddQuickApp2SettingsFormSelector.changeModelButtonLabel,
    this.orchestratorModel.getElementLocator(),
  );
  // Temperature slider — rendered only when the selected model allows temperature
  public temperatureSlider = this.orchestratorSection.getChildElementBySelector(
    AddQuickApp2SettingsFormSelector.temperatureSlider,
  );
  // Validation error under the model field (e.g. model without tools support)
  public orchestratorModelError =
    this.orchestratorSection.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.orchestratorModelError,
    );
  // Instructions markdown editor + its edit textarea
  public instructionsField = this.orchestratorSection.getChildElementBySelector(
    AddQuickApp2SettingsFormSelector.instructionsField,
  );
  public instructionsInput = this.instructionsField.getChildElementBySelector(
    AddQuickApp2SettingsFormSelector.instructionsInput,
  );
  public contextToolsSection = this.getChildElementBySelector(
    AddQuickApp2SettingsFormSelector.contextToolsSection,
  );
  public attachmentsSection = this.getChildElementBySelector(
    AddQuickApp2SettingsFormSelector.attachmentsSection,
  );
  // Attachments section is collapsed by default — toggle header + its fields
  public attachmentsSectionToggle =
    this.attachmentsSection.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.sectionToggle,
    );
  public attachmentTypesField =
    this.attachmentsSection.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.attachmentTypesField,
    );
  // Same widget as the shared Combobox; QA2 just overrides the container data-qa.
  public attachmentTypes = new Combobox(
    this.page,
    this.attachmentsSection.getElementLocator(),
    AddQuickApp2SettingsFormSelector.attachmentTypesField,
  );
  public maxAttachmentsInput =
    this.attachmentsSection.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.maxAttachmentsField,
    );

  // Expand the attachments section and set the attachment types + max number.
  public async setAttachments(
    attachmentTypes: string[],
    maxAttachments: string,
  ) {
    await this.attachmentsSectionToggle.click();
    for (let i = 0; i < attachmentTypes.length; i++) {
      await this.attachmentTypes.comboboxInput.typeInInput(attachmentTypes[i], {
        delay: keyEnteringDelay,
      });
      await this.page.keyboard.press(keys.enter);
      await this.attachmentTypes.selectedPills.getNthElement(i + 1).waitFor();
    }
    await this.maxAttachmentsInput.typeInInput(maxAttachments);
  }

  public conversationStartersSection = this.getChildElementBySelector(
    AddQuickApp2SettingsFormSelector.conversationStartersSection,
  );
  public conversationStartersSectionToggle =
    this.conversationStartersSection.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.sectionToggle,
    );
  // Rendered only when the conversation starters section is expanded
  public conversationStartersList =
    this.conversationStartersSection.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.conversationStartersList,
    );
  public introTextInput =
    this.conversationStartersSection.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.introTextInput,
    );

  // Add a starter by filling the last (empty) row: title then prompt.
  // The list appends a fresh empty row once a row gets content, so target the
  // current last row (its two inputs) to support adding several starters.
  public async addStarter(title: string, prompt: string) {
    const inputs = this.conversationStartersList.getChildElementBySelector(
      Tags.input,
    );
    const count = await inputs.getElementsCount();
    await inputs.getNthElement(count - 1).fill(title);
    await inputs.getNthElement(count).fill(prompt);
  }

  // Remove a starter by its 1-based row index (the trash button of that row).
  // The last empty row's trash is disabled, so only real starters are removable.
  public async removeStarter(rowIndex: number) {
    await this.conversationStartersList
      .getChildElementBySelector(Tags.button)
      .getNthElement(rowIndex)
      .click();
  }

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
  public codeInterpreterLabel =
    this.codeInterpreterField.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.codeInterpreterLabel,
    );
  public codeInterpreterInfoIcon =
    this.codeInterpreterField.getChildElementBySelector(
      AddQuickApp2SettingsFormSelector.codeInterpreterInfoIcon,
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

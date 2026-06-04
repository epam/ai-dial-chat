import { EntityEditorAppTypes, EntityEditorToolsetTypes } from '@/src/testData';
import { BasePage } from '@/src/ui/pages/basePage';
import {
  CustomAppEditorContainer,
  EntityEditorGeneralForm,
  EntityEditorGeneralInfoPreview,
  EntityEditorHeader,
  ExternalAppEditorContainer,
  QuickApp2EditorContainer,
  ToolsetEditorContainer,
} from '@/src/ui/webElements';

export class EntityEditorPage extends BasePage {
  // Common elements - single instances shared by all containers
  private entityEditorHeader!: EntityEditorHeader;
  private entityEditorGeneralForm!: EntityEditorGeneralForm;
  private entityEditorGeneralInfoPreview!: EntityEditorGeneralInfoPreview;

  //declare specific entity containers
  private customAppEditorContainer!: CustomAppEditorContainer;
  private externalAppEditorContainer!: ExternalAppEditorContainer;
  private quickApp2EditorContainer!: QuickApp2EditorContainer;
  private toolsetEditorContainer!: ToolsetEditorContainer;

  getEntityEditorHeader(): EntityEditorHeader {
    if (!this.entityEditorHeader) {
      this.entityEditorHeader = new EntityEditorHeader(this.page);
    }
    return this.entityEditorHeader;
  }

  getEntityEditorGeneralForm(): EntityEditorGeneralForm {
    if (!this.entityEditorGeneralForm) {
      this.entityEditorGeneralForm = new EntityEditorGeneralForm(this.page);
    }
    return this.entityEditorGeneralForm;
  }

  getEntityEditorGeneralInfoPreview(): EntityEditorGeneralInfoPreview {
    if (!this.entityEditorGeneralInfoPreview) {
      this.entityEditorGeneralInfoPreview = new EntityEditorGeneralInfoPreview(
        this.page,
      );
    }
    return this.entityEditorGeneralInfoPreview;
  }

  //init specific app type
  getCustomAppEditorContainer(): CustomAppEditorContainer {
    if (!this.customAppEditorContainer) {
      this.customAppEditorContainer = new CustomAppEditorContainer(
        this.page,
        this.getEntityEditorHeader(),
        this.getEntityEditorGeneralForm(),
        this.getEntityEditorGeneralInfoPreview(),
      );
    }
    return this.customAppEditorContainer;
  }

  getExternalAppEditorContainer(): ExternalAppEditorContainer {
    if (!this.externalAppEditorContainer) {
      this.externalAppEditorContainer = new ExternalAppEditorContainer(
        this.page,
        this.getEntityEditorHeader(),
        this.getEntityEditorGeneralForm(),
        this.getEntityEditorGeneralInfoPreview(),
      );
    }
    return this.externalAppEditorContainer;
  }

  getQuickApp2EditorContainer(): QuickApp2EditorContainer {
    if (!this.quickApp2EditorContainer) {
      this.quickApp2EditorContainer = new QuickApp2EditorContainer(
        this.page,
        this.getEntityEditorHeader(),
        this.getEntityEditorGeneralForm(),
        this.getEntityEditorGeneralInfoPreview(),
      );
    }
    return this.quickApp2EditorContainer;
  }

  getToolsetEditorContainer(): ToolsetEditorContainer {
    if (!this.toolsetEditorContainer) {
      this.toolsetEditorContainer = new ToolsetEditorContainer(
        this.page,
        this.getEntityEditorHeader(),
        this.getEntityEditorGeneralForm(),
        this.getEntityEditorGeneralInfoPreview(),
      );
    }
    return this.toolsetEditorContainer;
  }

  //get generic container based on entity type
  getEntityEditorContainer(
    entityType: EntityEditorAppTypes | EntityEditorToolsetTypes,
  ) {
    switch (entityType) {
      case EntityEditorAppTypes.CustomApp:
        return this.getCustomAppEditorContainer();
      case EntityEditorAppTypes.ExternalApp:
        return this.getExternalAppEditorContainer();
      case EntityEditorAppTypes.QuickApp2:
        return this.getQuickApp2EditorContainer();
      case EntityEditorToolsetTypes.Toolset:
        return this.getToolsetEditorContainer();
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  async waitForPageLoaded(
    entityType: EntityEditorAppTypes | EntityEditorToolsetTypes,
  ) {
    const entityEditorContainer =
      await this.waitForEntityEditorLoaded(entityType);
    const entityGeneralForm =
      entityEditorContainer.getEntityEditorGeneralForm();
    const entityPreview =
      entityEditorContainer.getEntityEditorGeneralInfoPreview();
    await Promise.all([
      entityGeneralForm.waitForState(),
      entityPreview.getEntityEditorPreviewCard().waitForState(),
    ]);
  }

  async waitForPageLoadedForEdit(
    entityType: EntityEditorAppTypes | EntityEditorToolsetTypes,
  ) {
    const entityEditorContainer =
      await this.waitForEntityEditorLoaded(entityType);
    const entityViewForm = entityEditorContainer.getEntityEditorViewForm();
    const entityPreview =
      entityEditorContainer.getEntityEditorEntitySettingsPreview();
    await Promise.all([
      entityViewForm.waitForState(),
      entityPreview.waitForState(),
    ]);
  }

  private async waitForEntityEditorLoaded(
    entityType: EntityEditorAppTypes | EntityEditorToolsetTypes,
  ) {
    const entityEditorContainer = this.getEntityEditorContainer(entityType);
    await Promise.all([
      entityEditorContainer.getChatLoader().waitForState({ state: 'hidden' }),
      entityEditorContainer.getHeader().waitForState(),
    ]);
    return entityEditorContainer;
  }
}

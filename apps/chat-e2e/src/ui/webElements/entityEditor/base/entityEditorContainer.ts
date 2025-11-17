import { ChatSelectors } from '@/src/ui/selectors';
import {
  BaseElement,
  EntityEditorEntitySettingsPreview,
  EntityEditorEntitySettingsPreviewBody,
  EntityEditorGeneralForm,
  EntityEditorGeneralInfoPreview,
  EntityEditorHeader,
  EntityEditorViewForm,
} from '@/src/ui/webElements';
import { BaseLayoutContainer } from '@/src/ui/webElements/baseLayoutContainer';
import { Page } from '@playwright/test';

export abstract class EntityEditorContainer<
  E extends EntityEditorViewForm,
  B extends EntityEditorEntitySettingsPreviewBody,
  P extends EntityEditorEntitySettingsPreview<B>,
> extends BaseLayoutContainer<EntityEditorHeader> {
  //common General form
  private readonly entityEditorGeneralForm!: EntityEditorGeneralForm;
  //common General Preview
  private readonly entityEditorGeneralInfoPreview!: EntityEditorGeneralInfoPreview;
  //abstract entity Editor View form
  protected abstract entityEditorViewForm: E;
  //abstract entity Editor Preview
  protected abstract entityEditorEntitySettingsPreview: P;

  protected constructor(
    page: Page,
    header: EntityEditorHeader,
    generalForm: EntityEditorGeneralForm,
    generalInfoPreview: EntityEditorGeneralInfoPreview,
  ) {
    super(page);
    this.header = header;
    this.entityEditorGeneralForm = generalForm;
    this.entityEditorGeneralInfoPreview = generalInfoPreview;
  }

  //common top header
  getHeader(): EntityEditorHeader {
    return this.header;
  }

  getEntityEditorGeneralForm(): EntityEditorGeneralForm {
    return this.entityEditorGeneralForm;
  }

  getEntityEditorGeneralInfoPreview(): EntityEditorGeneralInfoPreview {
    return this.entityEditorGeneralInfoPreview;
  }

  abstract getEntityEditorViewForm(): E;

  abstract getEntityEditorEntitySettingsPreview(): P;

  getChatLoader(): BaseElement {
    return this.getChildElementBySelector(ChatSelectors.entitySpinner);
  }
}

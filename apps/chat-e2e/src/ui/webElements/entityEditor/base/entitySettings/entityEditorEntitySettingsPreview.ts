import { EntityEditorEntitySettingsPreviewSelectors } from '@/src/ui/selectors';
import {
  BaseElement,
  EntityEditorEntitySettingsPreviewBody,
  EntityEditorEntitySettingsPreviewHeader,
} from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export abstract class EntityEditorEntitySettingsPreview<
  B extends EntityEditorEntitySettingsPreviewBody,
> extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      EntityEditorEntitySettingsPreviewSelectors.container,
      parentLocator,
    );
  }

  private entityEditorEntitySettingsPreviewHeader!: EntityEditorEntitySettingsPreviewHeader;
  protected abstract entityEditorEntitySettingsPreviewBody: B;

  getEntityEditorEntitySettingsPreviewHeader(): EntityEditorEntitySettingsPreviewHeader {
    if (!this.entityEditorEntitySettingsPreviewHeader) {
      this.entityEditorEntitySettingsPreviewHeader =
        new EntityEditorEntitySettingsPreviewHeader(
          this.page,
          this.rootLocator,
        );
    }
    return this.entityEditorEntitySettingsPreviewHeader;
  }

  abstract getEntityEditorEntitySettingsPreviewBody(): B;
}

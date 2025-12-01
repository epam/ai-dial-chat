import { AddEntitySettingsFormSelector } from '@/src/ui/selectors';
import { EntityEditorForm } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export abstract class EntityEditorViewForm extends EntityEditorForm {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      AddEntitySettingsFormSelector.entityViewFormContainer,
      parentLocator,
    );
  }
}

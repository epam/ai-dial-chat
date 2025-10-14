import { AddApplicationAppSettingsFormSelector } from '@/src/ui/selectors';
import { BaseAppEditorForm } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export abstract class BaseAppEditorViewForm extends BaseAppEditorForm {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      AddApplicationAppSettingsFormSelector.appViewFormContainer,
      parentLocator,
    );
  }
}

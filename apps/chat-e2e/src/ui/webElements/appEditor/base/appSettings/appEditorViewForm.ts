import { AddApplicationAppSettingsFormSelector } from '@/src/ui/selectors';
import { AppEditorForm } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export abstract class AppEditorViewForm extends AppEditorForm {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      AddApplicationAppSettingsFormSelector.appViewFormContainer,
      parentLocator,
    );
  }
}

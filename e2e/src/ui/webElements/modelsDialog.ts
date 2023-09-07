import { ModelDialog } from '../selectors';
import { BaseElement } from './baseElement';

import { Groups } from '@/e2e/src/testData';
import { Page } from '@playwright/test';

export class ModelsDialog extends BaseElement {
  constructor(page: Page) {
    super(page, ModelDialog.modelDialog);
  }

  public entityOptionsByGroup = (group: Groups) =>
    this.getChildElementBySelector(ModelDialog.talkToGroup)
      .getElementLocatorByText(group)
      .locator(ModelDialog.groupEntity);

  public entityOptionByGroup = (group: Groups, option: string) =>
    this.entityOptionsByGroup(group)
      .locator(ModelDialog.groupEntityName)
      .filter({ hasText: option });

  public async selectAssistant(assistant: string) {
    await this.entityOptionByGroup(Groups.assistants, assistant).click();
    await this.waitForState({ state: 'hidden' });
  }
}

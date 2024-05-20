import { ChatSelectors, ErrorLabelSelectors, ModelDialog } from '../selectors';
import { BaseElement } from './baseElement';

import { Groups } from '@/src/testData';
import { TalkToGroup } from '@/src/ui/webElements/talkToGroup';
import { Page } from '@playwright/test';

export class ModelsDialog extends BaseElement {
  constructor(page: Page) {
    super(page, ModelDialog.modelDialog);
  }

  public talkToModels!: TalkToGroup;
  public talkToAssistants!: TalkToGroup;
  public talkToApplications!: TalkToGroup;

  getTalkToModels(): TalkToGroup {
    if (!this.talkToModels) {
      this.talkToModels = new TalkToGroup(
        this.page,
        this.rootLocator,
        Groups.models,
      );
    }
    return this.talkToModels;
  }

  getTalkToAssistants(): TalkToGroup {
    if (!this.talkToAssistants) {
      this.talkToAssistants = new TalkToGroup(
        this.page,
        this.rootLocator,
        Groups.assistants,
      );
    }
    return this.talkToAssistants;
  }

  getTalkToApplications(): TalkToGroup {
    if (!this.talkToApplications) {
      this.talkToApplications = new TalkToGroup(
        this.page,
        this.rootLocator,
        Groups.applications,
      );
    }
    return this.talkToApplications;
  }

  public searchInput = this.getChildElementBySelector(ModelDialog.searchInput);

  public closeButton = this.getChildElementBySelector(ModelDialog.closeDialog);
  public noResultFoundIcon = this.getChildElementBySelector(
    ErrorLabelSelectors.noResultFound,
  );
  public modelsTab = this.getChildElementBySelector(ModelDialog.modelsTab);
  public assistantsTab = this.getChildElementBySelector(
    ModelDialog.assistantsTab,
  );
  public applicationsTab = this.getChildElementBySelector(
    ModelDialog.applicationsTab,
  );

  public async closeDialog() {
    await this.closeButton.click();
    await this.waitForState({ state: 'hidden' });
  }
}

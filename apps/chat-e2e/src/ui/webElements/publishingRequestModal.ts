import { PublishingModalSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { ChangePath } from '@/src/ui/webElements/changePath';
import {
  ApplicationsToPublish,
  ConversationsToPublish,
  FilesToPublish,
  FolderConversationsToPublish,
  FolderPromptsToPublish,
  PromptsToPublish,
} from '@/src/ui/webElements/entityTree';
import { Page } from '@playwright/test';

export class PublishingRequestModal extends BaseElement {
  constructor(page: Page) {
    super(page, PublishingModalSelectors.modalContainer);
  }

  //conversations to publish trees
  private conversationsToPublish!: ConversationsToPublish;
  private folderConversationsToPublish!: FolderConversationsToPublish;
  //files to publish tree
  private filesToPublish!: FilesToPublish;
  //prompts to publish trees
  private promptsToPublish!: PromptsToPublish;
  private folderPromptsToPublish!: FolderPromptsToPublish;
  //applications to publish tree
  private applicationsToPublish!: ApplicationsToPublish;
  //change publish path element
  private changePublishToPath!: ChangePath;

  getConversationsToPublish(): ConversationsToPublish {
    if (!this.conversationsToPublish) {
      this.conversationsToPublish = new ConversationsToPublish(
        this.page,
        this.rootLocator,
      );
    }
    return this.conversationsToPublish;
  }

  getFolderConversationsToPublish(): FolderConversationsToPublish {
    if (!this.folderConversationsToPublish) {
      this.folderConversationsToPublish = new FolderConversationsToPublish(
        this.page,
        this.rootLocator,
      );
    }
    return this.folderConversationsToPublish;
  }

  getFilesToPublish(): FilesToPublish {
    if (!this.filesToPublish) {
      this.filesToPublish = new FilesToPublish(this.page, this.rootLocator);
    }
    return this.filesToPublish;
  }

  getPromptsToPublish(): PromptsToPublish {
    if (!this.promptsToPublish) {
      this.promptsToPublish = new PromptsToPublish(this.page, this.rootLocator);
    }
    return this.promptsToPublish;
  }

  getFolderPromptsToPublish(): FolderPromptsToPublish {
    if (!this.folderPromptsToPublish) {
      this.folderPromptsToPublish = new FolderPromptsToPublish(
        this.page,
        this.rootLocator,
      );
    }
    return this.folderPromptsToPublish;
  }

  getApplicationsToPublish(): ApplicationsToPublish {
    if (!this.applicationsToPublish) {
      this.applicationsToPublish = new ApplicationsToPublish(
        this.page,
        this.rootLocator,
      );
    }
    return this.applicationsToPublish;
  }

  getChangePublishToPath(): ChangePath {
    if (!this.changePublishToPath) {
      this.changePublishToPath = new ChangePath(this.page, this.rootLocator);
    }
    return this.changePublishToPath;
  }

  public requestName = this.getChildElementBySelector(
    PublishingModalSelectors.requestName,
  );
  public sendRequestButton = this.getChildElementBySelector(
    PublishingModalSelectors.sendButton,
  );
}

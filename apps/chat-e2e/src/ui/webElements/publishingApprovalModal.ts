import { PublishingApprovalModalSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import {
  ApplicationsToApprove,
  ConversationsToApprove,
  FilesToApprove,
  FolderConversationsToApprove,
  FolderFilesToApprove,
  FolderPromptsToApprove,
  PromptsToApprove,
} from '@/src/ui/webElements/entityTree';
import { Page } from '@playwright/test';

export class PublishingApprovalModal extends BaseElement {
  constructor(page: Page) {
    super(page, PublishingApprovalModalSelectors.modalContainer);
  }

  //conversations to approve trees
  private conversationsToApprove!: ConversationsToApprove;
  private folderConversationsToApprove!: FolderConversationsToApprove;
  //files to approve trees
  private filesToApprove!: FilesToApprove;
  private folderFilesToApprove!: FolderFilesToApprove;
  //prompts to approve trees
  private promptsToApprove!: PromptsToApprove;
  private folderPromptsToApprove!: FolderPromptsToApprove;
  //applications to approve tree
  private applicationsToPublish!: ApplicationsToApprove;

  getConversationsToApprove(): ConversationsToApprove {
    if (!this.conversationsToApprove) {
      this.conversationsToApprove = new ConversationsToApprove(
        this.page,
        this.rootLocator,
      );
    }
    return this.conversationsToApprove;
  }

  getFolderConversationsToApprove(): FolderConversationsToApprove {
    if (!this.folderConversationsToApprove) {
      this.folderConversationsToApprove = new FolderConversationsToApprove(
        this.page,
        this.rootLocator,
      );
    }
    return this.folderConversationsToApprove;
  }

  getFilesToApprove(): FilesToApprove {
    if (!this.filesToApprove) {
      this.filesToApprove = new FilesToApprove(this.page, this.rootLocator);
    }
    return this.filesToApprove;
  }

  getFolderFilesToApprove(): FolderFilesToApprove {
    if (!this.folderFilesToApprove) {
      this.folderFilesToApprove = new FolderFilesToApprove(
        this.page,
        this.rootLocator,
      );
    }
    return this.folderFilesToApprove;
  }

  getPromptsToApprove(): PromptsToApprove {
    if (!this.promptsToApprove) {
      this.promptsToApprove = new PromptsToApprove(this.page, this.rootLocator);
    }
    return this.promptsToApprove;
  }

  getFolderPromptsToApprove(): FolderPromptsToApprove {
    if (!this.folderPromptsToApprove) {
      this.folderPromptsToApprove = new FolderPromptsToApprove(
        this.page,
        this.rootLocator,
      );
    }
    return this.folderPromptsToApprove;
  }

  getApplicationsToApprove(): ApplicationsToApprove {
    if (!this.applicationsToPublish) {
      this.applicationsToPublish = new ApplicationsToApprove(
        this.page,
        this.rootLocator,
      );
    }
    return this.applicationsToPublish;
  }

  public publishName = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.publishName,
  );
  public publishToPath = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.publishToPath,
  );
  public publishDate = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.publishDate,
  );
}

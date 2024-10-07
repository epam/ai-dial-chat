import { API } from '@/src/testData';
import { PublishingApprovalModalSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import {
  ApplicationsToApproveTree,
  ConversationsToApproveTree,
  FilesToApproveTree,
  FolderConversationsToApprove,
  FolderFilesToApprove,
  FolderPromptsToApprove,
  PromptsToApproveTree,
} from '@/src/ui/webElements/entityTree';
import { Page } from '@playwright/test';

export class PublishingApprovalModal extends BaseElement {
  constructor(page: Page) {
    super(page, PublishingApprovalModalSelectors.modalContainer);
  }

  //conversations to approve trees
  private conversationsToApproveTree!: ConversationsToApproveTree;
  private folderConversationsToApprove!: FolderConversationsToApprove;
  //files to approve trees
  private filesToApproveTree!: FilesToApproveTree;
  private folderFilesToApprove!: FolderFilesToApprove;
  //prompts to approve trees
  private promptsToApproveTree!: PromptsToApproveTree;
  private folderPromptsToApprove!: FolderPromptsToApprove;
  //applications to approve tree
  private applicationsToPublishTree!: ApplicationsToApproveTree;

  getConversationsToApproveTree(): ConversationsToApproveTree {
    if (!this.conversationsToApproveTree) {
      this.conversationsToApproveTree = new ConversationsToApproveTree(
        this.page,
        this.rootLocator,
      );
    }
    return this.conversationsToApproveTree;
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

  getFilesToApproveTree(): FilesToApproveTree {
    if (!this.filesToApproveTree) {
      this.filesToApproveTree = new FilesToApproveTree(
        this.page,
        this.rootLocator,
      );
    }
    return this.filesToApproveTree;
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

  getPromptsToApproveTree(): PromptsToApproveTree {
    if (!this.promptsToApproveTree) {
      this.promptsToApproveTree = new PromptsToApproveTree(
        this.page,
        this.rootLocator,
      );
    }
    return this.promptsToApproveTree;
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

  getApplicationsToApproveTree(): ApplicationsToApproveTree {
    if (!this.applicationsToPublishTree) {
      this.applicationsToPublishTree = new ApplicationsToApproveTree(
        this.page,
        this.rootLocator,
      );
    }
    return this.applicationsToPublishTree;
  }

  public publishName = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.publishName,
  );
  public publishToPathLabel = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.publishToPathLabel,
  );
  public publishToPath = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.publishToPath,
  );
  public publishDateLabel = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.publishDateLabel,
  );
  public publishDate = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.publishDate,
  );
  public allowAccessLabel = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.allowAccessLabel,
  );
  public noChangesLabel = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.noChangesLabel,
  );
  public availabilityLabel = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.availabilityLabel,
  );
  public goToReviewButton = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.goToReviewButton,
  );
  public approveButton = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.approveButton,
  );
  public rejectButton = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.rejectButton,
  );

  public async approveRequest() {
    const responsePromise = this.page.waitForResponse((r) =>
      r.request().url().includes(API.publicationRequestApproval),
    );
    await this.approveButton.click();
    await responsePromise;
  }

  public async goToEntityReview() {
    const responsePromise = this.page.waitForResponse(
      (r) => r.request().method() === 'GET',
    );
    await this.goToReviewButton.click();
    await responsePromise;
  }
}

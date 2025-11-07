import { API } from '@/src/testData';
import { Tags } from '@/src/ui/domData';
import {
  EntitySelectors,
  IconSelectors,
  PublishEntitySelectors,
  PublishingApprovalModalSelectors,
} from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import {
  PublishApplicationsTree,
  PublishConversationsTree,
  PublishFolderConversations,
  PublishFolderPrompts,
  PublishPromptsTree,
} from '@/src/ui/webElements/entityTree';
import { PublishFilesTree } from '@/src/ui/webElements/entityTree/publication/publishFilesTree';
import { PublishingRules } from '@/src/ui/webElements/publishingRules';
import { Page } from '@playwright/test';

export class PublishingApprovalModal extends BaseElement {
  constructor(page: Page) {
    super(page, PublishingApprovalModalSelectors.modalContainer);
  }

  //conversations to approve trees
  private conversationsToApproveTree!: PublishConversationsTree;
  private folderConversationsToApprove!: PublishFolderConversations;
  //files to approve trees
  private filesToApproveTree!: PublishFilesTree;
  //prompts to approve trees
  private promptsToApproveTree!: PublishPromptsTree;
  private folderPromptsToApprove!: PublishFolderPrompts;
  //applications to approve tree
  private applicationsToPublishTree!: PublishApplicationsTree;
  private publishingRules!: PublishingRules;

  getConversationsToApproveTree(): PublishConversationsTree {
    if (!this.conversationsToApproveTree) {
      this.conversationsToApproveTree = new PublishConversationsTree(
        this.page,
        this.rootLocator,
      );
    }
    return this.conversationsToApproveTree;
  }

  getFolderConversationsToApprove(): PublishFolderConversations {
    if (!this.folderConversationsToApprove) {
      this.folderConversationsToApprove = new PublishFolderConversations(
        this.page,
        this.rootLocator,
      );
    }
    return this.folderConversationsToApprove;
  }

  getFilesToApproveTree(): PublishFilesTree {
    if (!this.filesToApproveTree) {
      this.filesToApproveTree = new PublishFilesTree(
        this.page,
        this.rootLocator,
      );
    }
    return this.filesToApproveTree;
  }

  getPromptsToApproveTree(): PublishPromptsTree {
    if (!this.promptsToApproveTree) {
      this.promptsToApproveTree = new PublishPromptsTree(
        this.page,
        this.rootLocator,
      );
    }
    return this.promptsToApproveTree;
  }

  getFolderPromptsToApprove(): PublishFolderPrompts {
    if (!this.folderPromptsToApprove) {
      this.folderPromptsToApprove = new PublishFolderPrompts(
        this.page,
        this.rootLocator,
      );
    }
    return this.folderPromptsToApprove;
  }

  getApplicationsToApproveTree(): PublishApplicationsTree {
    if (!this.applicationsToPublishTree) {
      this.applicationsToPublishTree = new PublishApplicationsTree(
        this.page,
        this.rootLocator,
      );
    }
    return this.applicationsToPublishTree;
  }

  getPublishingRules(): PublishingRules {
    if (!this.publishingRules) {
      this.publishingRules = new PublishingRules(this.page, this.rootLocator);
    }
    return this.publishingRules;
  }

  public publishName = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.publishName,
  );
  public publishPathLabel = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.publishPathLabel,
  );
  public publishPath = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.publishPath,
  );
  public requestCreatedLabel = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.requestCreatedLabel,
  );
  public creationDate = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.creationDate,
  );
  public authorLabel = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.authorLabel,
  );
  public author = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.author,
  );
  public publicAuthor = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.publicAuthor,
  );
  public publicAuthorLabel = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.publicAuthorLabel,
  );
  public publicAuthorHelpIcon =
    this.publicAuthorLabel.getChildElementBySelector(IconSelectors.helpIcon);
  public goToReviewButton = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.goToReviewButton,
  );
  public approveButton = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.approveButton,
  );
  public rejectButton = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.rejectButton,
  );
  public duplicatedUnpublishingError = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.duplicatedPublishing,
  );
  public editButton = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.editButton,
  );
  public updateRequestButton = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.updateRequestButton,
  );
  public publicAuthorContainerEditMode = this.getChildElementBySelector(
    PublishingApprovalModalSelectors.publicAuthorContainerEditMode,
  );
  public publicAuthorInputEditMode =
    this.publicAuthorContainerEditMode.getChildElementBySelector(Tags.input);
  public conversationToApproveRow =
    this.getConversationsToApproveTree().getChildElementBySelector(
      PublishingApprovalModalSelectors.entityRow,
    );

  public async approveRequest({
    isModelsListRetrieved = false,
  }: { isModelsListRetrieved?: boolean } = {}) {
    const respPromises = [];
    const responsePromise = this.page.waitForResponse((r) =>
      r.request().url().includes(API.publicationRequestApproval),
    );
    respPromises.push(responsePromise);
    if (isModelsListRetrieved) {
      const responsePromise = this.page.waitForResponse(
        (r) =>
          r.request().method() === 'GET' &&
          r.url().includes(API.modelsHost) &&
          r.ok(),
      );
      respPromises.push(responsePromise);
    }
    await this.approveButton.click();
    await Promise.all(respPromises);
  }

  public async goToEntityReview({
    isHttpMethodTriggered = true,
  }: { isHttpMethodTriggered?: boolean } = {}) {
    if (isHttpMethodTriggered) {
      const responsePromise = this.page.waitForResponse(
        (r) => r.request().method() === 'GET',
      );
      await this.goToReviewButton.click();
      await responsePromise;
    } else {
      await this.goToReviewButton.click();
    }
  }

  public async rejectRequest() {
    const responsePromise = this.page.waitForResponse((r) =>
      r.request().url().includes(API.publicationRequestRejection),
    );
    await this.rejectButton.click();
    await responsePromise;
  }

  public async renameConversationToApprove(
    conversationName: string,
    newName: string,
  ) {
    if (await this.editButton.isVisible()) {
      await this.editButton.click();
    }
    const conversationInput = this.getConversationsToApproveTree()
      .getChildElementBySelector(`${Tags.input}[value="${conversationName}"]`)
      .getElementLocator();

    await conversationInput.click();
    await conversationInput.fill(newName);
    return newName;
  }

  public async renameConversationToApproveVersion(
    conversationName: string,
    newVersion: string,
  ) {
    if (await this.editButton.isVisible()) {
      await this.editButton.click();
    }

    const conversationRow = this.conversationToApproveRow.getElementLocator();

    const filter = conversationRow.filter({
      has: this.page.locator(`[value="${conversationName}"]`),
    });

    const versionInput = filter
      .locator(PublishEntitySelectors.version)
      .locator(Tags.input);

    await versionInput.click();
    await versionInput.fill(newVersion);
    return newVersion;
  }

  public async renameFileToApprove(fileName: string, newName: string) {
    if (await this.editButton.isVisible()) {
      await this.editButton.click();
    }
    const fileInput = this.getFilesToApproveTree()
      .getChildElementBySelector(`${Tags.input}[value="${fileName}"]`)
      .getElementLocator();

    await fileInput.click();
    await fileInput.fill(newName);
  }
}

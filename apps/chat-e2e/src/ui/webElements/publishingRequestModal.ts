import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import { API } from '@/src/testData';
import { PublishingModalSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { ChangePath } from '@/src/ui/webElements/changePath';
import {
  ApplicationsToPublishTree,
  ConversationsToPublishTree,
  FilesToPublishTree,
  FolderConversationsToPublish,
  FolderPromptsToPublish,
  PromptsToPublishTree,
} from '@/src/ui/webElements/entityTree';
import { Page } from '@playwright/test';

export class PublishingRequestModal extends BaseElement {
  constructor(page: Page) {
    super(page, PublishingModalSelectors.modalContainer);
  }

  //conversations to publish trees
  private conversationsToPublishTree!: ConversationsToPublishTree;
  private folderConversationsToPublish!: FolderConversationsToPublish;
  //files to publish tree
  private filesToPublishTree!: FilesToPublishTree;
  //prompts to publish trees
  private promptsToPublishTree!: PromptsToPublishTree;
  private folderPromptsToPublish!: FolderPromptsToPublish;
  //applications to publish tree
  private applicationsToPublishTree!: ApplicationsToPublishTree;
  //change publish path element
  private changePublishToPath!: ChangePath;

  getConversationsToPublishTree(): ConversationsToPublishTree {
    if (!this.conversationsToPublishTree) {
      this.conversationsToPublishTree = new ConversationsToPublishTree(
        this.page,
        this.rootLocator,
      );
    }
    return this.conversationsToPublishTree;
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

  getFilesToPublishTree(): FilesToPublishTree {
    if (!this.filesToPublishTree) {
      this.filesToPublishTree = new FilesToPublishTree(
        this.page,
        this.rootLocator,
      );
    }
    return this.filesToPublishTree;
  }

  getPromptsToPublishTree(): PromptsToPublishTree {
    if (!this.promptsToPublishTree) {
      this.promptsToPublishTree = new PromptsToPublishTree(
        this.page,
        this.rootLocator,
      );
    }
    return this.promptsToPublishTree;
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

  getApplicationsToPublishTree(): ApplicationsToPublishTree {
    if (!this.applicationsToPublishTree) {
      this.applicationsToPublishTree = new ApplicationsToPublishTree(
        this.page,
        this.rootLocator,
      );
    }
    return this.applicationsToPublishTree;
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

  public async sendPublicationRequest() {
    const respPromise = this.page.waitForResponse((resp) =>
      resp.url().includes(API.publicationRequestHost),
    );
    await this.sendRequestButton.click();
    const response = await respPromise;
    const request = (await response
      .request()
      .postDataJSON()) as PublicationRequestModel;
    const responseText = await response.text();
    return {
      request: request,
      response: JSON.parse(responseText) as Publication,
    };
  }
}

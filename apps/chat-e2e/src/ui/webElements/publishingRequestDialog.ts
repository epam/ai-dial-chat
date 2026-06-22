import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import { API } from '@/src/testData';
import { AttributeValues, Tags } from '@/src/ui/domData';
import { IconSelectors, PublishingDialogSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { ChangePath } from '@/src/ui/webElements/changePath';
import { Button } from '@/src/ui/webElements/common/button';
import {
  PublishApplicationsTree,
  PublishConversationsTree,
  PublishFolderConversations,
  PublishFolderPrompts,
  PublishPromptsTree,
  PublishToolsetsTree,
} from '@/src/ui/webElements/entityTree';
import { PublishFilesTree } from '@/src/ui/webElements/entityTree/publication/publishFilesTree';
import { PublishingRules } from '@/src/ui/webElements/publishingRules';
import { Locator, Page } from '@playwright/test';

export class PublishingRequestDialog extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(page, PublishingDialogSelectors.dialogContainer, parentLocator);
  }

  public cancelButton = this.getChildElementBySelector(
    IconSelectors.cancelIcon,
  );

  //conversations to publish trees
  private conversationsToPublishTree!: PublishConversationsTree;
  private folderConversationsToPublish!: PublishFolderConversations;
  //files to publish tree
  private filesToPublishTree!: PublishFilesTree;
  //prompts to publish trees
  private promptsToPublishTree!: PublishPromptsTree;
  private folderPromptsToPublish!: PublishFolderPrompts;
  //applications to publish tree
  private applicationsToPublishTree!: PublishApplicationsTree;
  //toolsets to publish tree
  private toolsetsToPublishTree!: PublishToolsetsTree;
  //change publish path element
  private changePublishToPath!: ChangePath;
  private publishingRules!: PublishingRules;

  getConversationsToPublishTree(): PublishConversationsTree {
    if (!this.conversationsToPublishTree) {
      this.conversationsToPublishTree = new PublishConversationsTree(
        this.page,
        this.rootLocator,
      );
    }
    return this.conversationsToPublishTree;
  }

  getFolderConversationsToPublish(): PublishFolderConversations {
    if (!this.folderConversationsToPublish) {
      this.folderConversationsToPublish = new PublishFolderConversations(
        this.page,
        this.rootLocator,
      );
    }
    return this.folderConversationsToPublish;
  }

  getFilesToPublishTree(): PublishFilesTree {
    if (!this.filesToPublishTree) {
      this.filesToPublishTree = new PublishFilesTree(
        this.page,
        this.rootLocator,
      );
    }
    return this.filesToPublishTree;
  }

  getPromptsToPublishTree(): PublishPromptsTree {
    if (!this.promptsToPublishTree) {
      this.promptsToPublishTree = new PublishPromptsTree(
        this.page,
        this.rootLocator,
      );
    }
    return this.promptsToPublishTree;
  }

  getFolderPromptsToPublish(): PublishFolderPrompts {
    if (!this.folderPromptsToPublish) {
      this.folderPromptsToPublish = new PublishFolderPrompts(
        this.page,
        this.rootLocator,
      );
    }
    return this.folderPromptsToPublish;
  }

  getApplicationsToPublishTree(): PublishApplicationsTree {
    if (!this.applicationsToPublishTree) {
      this.applicationsToPublishTree = new PublishApplicationsTree(
        this.page,
        this.rootLocator,
      );
    }
    return this.applicationsToPublishTree;
  }

  getPublishToolsetsTree(): PublishToolsetsTree {
    if (!this.toolsetsToPublishTree) {
      this.toolsetsToPublishTree = new PublishToolsetsTree(
        this.page,
        this.rootLocator,
      );
    }
    return this.toolsetsToPublishTree;
  }

  getChangePublishToPath(): ChangePath {
    if (!this.changePublishToPath) {
      this.changePublishToPath = new ChangePath(this.page, this.rootLocator);
    }
    return this.changePublishToPath;
  }

  getPublishingRules(): PublishingRules {
    if (!this.publishingRules) {
      this.publishingRules = new PublishingRules(this.page, this.rootLocator);
    }
    return this.publishingRules;
  }

  public requestName = this.getChildElementBySelector(
    PublishingDialogSelectors.requestName,
  ).getChildElementBySelector(Tags.input);
  public requestNameErrorMessage = this.getChildElementBySelector(
    PublishingDialogSelectors.requestNameErrorMessage(),
  );
  public author = this.getChildElementBySelector(
    PublishingDialogSelectors.author,
  );
  public sendRequestButton = new Button(
    this.page,
    AttributeValues.sendRequest,
    this.rootLocator,
  );
  public publishPath = this.getChildElementBySelector(
    PublishingDialogSelectors.publishPath,
  );
  public publishPathLabel = this.getChildElementBySelector(
    PublishingDialogSelectors.publishPathLabel,
  );
  public authorLabel = this.getChildElementBySelector(
    PublishingDialogSelectors.authorLabel,
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

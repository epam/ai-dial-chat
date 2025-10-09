import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import { API } from '@/src/testData';
import { Tags } from '@/src/ui/domData';
import { IconSelectors, PublishingDialogSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { ChangePath } from '@/src/ui/webElements/changePath';
import {
  ApplicationsToPublishTree,
  FolderConversationsToPublish,
  FolderPromptsToPublish,
  PublishConversationsTree,
  PublishPromptsTree,
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
  private folderConversationsToPublish!: FolderConversationsToPublish;
  //files to publish tree
  private filesToPublishTree!: PublishFilesTree;
  //prompts to publish trees
  private promptsToPublishTree!: PublishPromptsTree;
  private folderPromptsToPublish!: FolderPromptsToPublish;
  //applications to publish tree
  private applicationsToPublishTree!: ApplicationsToPublishTree;
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

  getFolderConversationsToPublish(): FolderConversationsToPublish {
    if (!this.folderConversationsToPublish) {
      this.folderConversationsToPublish = new FolderConversationsToPublish(
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
  public sendRequestButton = this.getChildElementBySelector(
    PublishingDialogSelectors.sendButton,
  );
  public publishPath = this.getChildElementBySelector(
    PublishingDialogSelectors.publishPath,
  );
  public publishLabel = this.getChildElementBySelector(
    PublishingDialogSelectors.publishLabel,
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

import {
  ChatBarSelectors,
  MenuSelectors,
  SideBarSelectors,
} from '../selectors';

import { isApiStorageType } from '@/src/hooks/global-setup';
import { API, MenuOptions } from '@/src/testData';
import { DropdownMenu } from '@/src/ui/webElements/dropdownMenu';
import {
  ApproveRequiredConversationsTree,
  ApproveRequiredPrompts,
  ConversationsTree,
  FolderConversations,
  OrganizationConversationsTree,
  SharedFolderConversations,
  SharedWithMeConversationsTree,
} from '@/src/ui/webElements/entityTree';
import { SideBar } from '@/src/ui/webElements/sideBar';
import { Page } from '@playwright/test';

export class ChatBar extends SideBar {
  constructor(page: Page) {
    super(page, SideBarSelectors.chatBar);
  }

  private conversationsTree!: ConversationsTree;
  private sharedWithMeConversationsTree!: SharedWithMeConversationsTree;
  private folderConversations!: FolderConversations;
  private sharedFolderConversations!: SharedFolderConversations;
  private approveRequiredConversationsTree!: ApproveRequiredConversationsTree;
  private approveRequiredPrompts!: ApproveRequiredPrompts;
  private organizationConversations!: OrganizationConversationsTree;
  private bottomDropdownMenu!: DropdownMenu;
  public compareButton = this.getChildElementBySelector(
    ChatBarSelectors.compare,
  );
  public attachments = this.getChildElementBySelector(
    ChatBarSelectors.attachments,
  );
  public bottomDotsMenuIcon = this.bottomPanel.getChildElementBySelector(
    MenuSelectors.dotsMenu,
  );

  getConversationsTree(): ConversationsTree {
    if (!this.conversationsTree) {
      this.conversationsTree = new ConversationsTree(
        this.page,
        this.rootLocator,
      );
    }
    return this.conversationsTree;
  }

  getSharedWithMeConversationsTree(): SharedWithMeConversationsTree {
    if (!this.sharedWithMeConversationsTree) {
      this.sharedWithMeConversationsTree = new SharedWithMeConversationsTree(
        this.page,
        this.rootLocator,
      );
    }
    return this.sharedWithMeConversationsTree;
  }

  getFolderConversations(): FolderConversations {
    if (!this.folderConversations) {
      this.folderConversations = new FolderConversations(
        this.page,
        this.getElementLocator(),
      );
    }
    return this.folderConversations;
  }

  getSharedFolderConversations(): SharedFolderConversations {
    if (!this.sharedFolderConversations) {
      this.sharedFolderConversations = new SharedFolderConversations(
        this.page,
        this.getElementLocator(),
      );
    }
    return this.sharedFolderConversations;
  }

  getApproveRequiredConversationsTree(): ApproveRequiredConversationsTree {
    if (!this.approveRequiredConversationsTree) {
      this.approveRequiredConversationsTree =
        new ApproveRequiredConversationsTree(
          this.page,
          this.getElementLocator(),
        );
    }
    return this.approveRequiredConversationsTree;
  }

  getApproveRequiredPrompts(): ApproveRequiredPrompts {
    if (!this.approveRequiredPrompts) {
      this.approveRequiredPrompts = new ApproveRequiredPrompts(
        this.page,
        this.getElementLocator(),
      );
    }
    return this.approveRequiredPrompts;
  }

  getOrganizationConversationsTree(): OrganizationConversationsTree {
    if (!this.organizationConversations) {
      this.organizationConversations = new OrganizationConversationsTree(
        this.page,
        this.getElementLocator(),
      );
    }
    return this.organizationConversations;
  }

  getBottomDropdownMenu(): DropdownMenu {
    if (!this.bottomDropdownMenu) {
      this.bottomDropdownMenu = new DropdownMenu(this.page);
    }
    return this.bottomDropdownMenu;
  }

  public async createNewConversation() {
    const modelsResponsePromise = this.page.waitForResponse(API.modelsHost);
    const addonsResponsePromise = this.page.waitForResponse(API.addonsHost);
    let putResponsePromise;
    if (isApiStorageType) {
      putResponsePromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'POST',
      );
    }
    await this.newEntityButton.click();
    await modelsResponsePromise;
    await addonsResponsePromise;
    if (isApiStorageType) {
      await putResponsePromise;
    }
  }

  public async openCompareMode() {
    await this.bottomDotsMenuIcon.click();
    const modelsResponsePromise = this.page.waitForResponse(API.modelsHost);
    const addonsResponsePromise = this.page.waitForResponse(API.addonsHost);
    await this.getBottomDropdownMenu().selectMenuOption(MenuOptions.compare);
    await modelsResponsePromise;
    await addonsResponsePromise;
  }

  public async drugConversationFromFolder(
    folderName: string,
    conversationName: string,
  ) {
    const folderConversation = this.getFolderConversations().getFolderEntity(
      folderName,
      conversationName,
    );
    await this.dragEntityFromFolder(folderConversation);
  }

  public async dragConversationToFolder(
    folderName: string,
    conversationName: string,
  ) {
    const folder = this.getFolderConversations().getFolderByName(folderName);
    const conversation =
      this.getConversationsTree().getEntityByName(conversationName);
    await this.dragEntityToFolder(conversation, folder);
  }

  public async drugAndDropConversationToFolderConversation(
    folderName: string,
    folderConversationName: string,
    conversationName: string,
    { isHttpMethodTriggered = false }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    const folderConversation = this.getFolderConversations().getFolderEntity(
      folderName,
      folderConversationName,
    );
    const conversation =
      this.getConversationsTree().getEntityByName(conversationName);
    await this.dragAndDropEntityToFolder(conversation, folderConversation, {
      isHttpMethodTriggered,
    });
  }

  public async dragAndDropFolderToRootLevel(
    folderName: string,
    { isHttpMethodTriggered = false }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    const folder = this.getFolderConversations().getFolderByName(folderName);
    await this.dragAndDropFolderToRoot(folder, { isHttpMethodTriggered });
  }
}

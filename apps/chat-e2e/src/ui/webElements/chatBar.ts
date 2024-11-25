import {
  ChatBarSelectors,
  EntitySelectors,
  MenuSelectors,
  SideBarSelectors,
} from '../selectors';

import { API, MenuOptions } from '@/src/testData';
import { DropdownMenu } from '@/src/ui/webElements/dropdownMenu';
import {
  ApproveRequiredConversationsTree,
  ApproveRequiredPrompts,
  ConversationsTree,
  FolderConversations,
  Folders,
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
  private organizationFolderConversations!: Folders;
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

  getOrganizationFolderConversations(): Folders {
    if (!this.organizationFolderConversations) {
      this.organizationFolderConversations = new Folders(
        this.page,
        this.getElementLocator(),
        ChatBarSelectors.organizationConversations(),
        EntitySelectors.conversation,
      );
    }
    return this.organizationFolderConversations;
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

  public async openCompareMode() {
    const modelsResponsePromise = this.page.waitForResponse(API.modelsHost);
    const addonsResponsePromise = this.page.waitForResponse(API.addonsHost);
    const isButtonVisible = await this.compareButton.isVisible();
    if (!isButtonVisible) {
      await this.bottomDotsMenuIcon.click();
      await this.getBottomDropdownMenu().selectMenuOption(MenuOptions.compare);
    } else {
      await this.compareButton.click();
    }
    await modelsResponsePromise;
    await addonsResponsePromise;
  }

  public async openManageAttachmentsModal() {
    const isButtonVisible = await this.attachments.isVisible();
    if (!isButtonVisible) {
      await this.bottomDotsMenuIcon.click();
      await this.getBottomDropdownMenu().selectMenuOption(
        MenuOptions.attachments,
      );
    } else {
      await this.attachments.click();
    }
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

  public async dragAndDropConversationToFolderConversation(
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

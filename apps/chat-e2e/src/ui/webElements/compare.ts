import { BaseElement } from './baseElement';
import { ConversationSettingsModal } from './conversationSettingsModal';

import { ChatSettingsSelectors, CompareSelectors } from '@/src/ui/selectors';
import { AgentInfo } from '@/src/ui/webElements/agentInfo';
import { ChatHeader } from '@/src/ui/webElements/chatHeader';
import { ChatMessages } from '@/src/ui/webElements/chatMessages';
import { ConversationToCompare } from '@/src/ui/webElements/conversationToCompare';
import { Page } from '@playwright/test';

export class Compare extends BaseElement {
  constructor(page: Page) {
    super(page, CompareSelectors.compareMode);
  }
  private leftAgentInfo!: AgentInfo;
  private rightAgentInfo!: AgentInfo;
  private leftConversationSettingsModal!: ConversationSettingsModal;
  private rightConversationSettingsModal!: ConversationSettingsModal;
  private chatMessages!: ChatMessages;
  private conversationToCompare!: ConversationToCompare;
  private rightChatHeader!: ChatHeader;
  private leftChatHeader!: ChatHeader;

  public leftConfigureSettingsButton = this.getChildElementBySelector(
    ChatSettingsSelectors.configureSettingsButton,
  ).getNthElement(1);
  public rightConfigureSettingsButton = this.getChildElementBySelector(
    ChatSettingsSelectors.configureSettingsButton,
  ).getNthElement(2);

  getLeftAgentInfo(): AgentInfo {
    if (!this.leftAgentInfo) {
      this.leftAgentInfo = new AgentInfo(this.page, this.rootLocator);
    }
    return this.leftAgentInfo;
  }

  getRightAgentInfo(): AgentInfo {
    if (!this.rightAgentInfo) {
      this.rightAgentInfo = new AgentInfo(this.page, this.rootLocator, 2);
    }
    return this.rightAgentInfo;
  }

  getLeftConversationSettingsModal(): ConversationSettingsModal {
    if (!this.leftConversationSettingsModal) {
      this.leftConversationSettingsModal = new ConversationSettingsModal(
        this.page,
      );
    }
    return this.leftConversationSettingsModal;
  }

  getRightConversationSettingsModal(): ConversationSettingsModal {
    if (!this.rightConversationSettingsModal) {
      this.rightConversationSettingsModal = new ConversationSettingsModal(
        this.page,
        undefined,
        2,
      );
    }
    return this.rightConversationSettingsModal;
  }

  getChatMessages(): ChatMessages {
    if (!this.chatMessages) {
      this.chatMessages = new ChatMessages(this.page, this.rootLocator);
    }
    return this.chatMessages;
  }

  getConversationToCompare(): ConversationToCompare {
    if (!this.conversationToCompare) {
      this.conversationToCompare = new ConversationToCompare(this.page);
    }
    return this.conversationToCompare;
  }

  getRightChatHeader(): ChatHeader {
    if (!this.rightChatHeader) {
      this.rightChatHeader = new ChatHeader(this.page, this.rootLocator, 2);
    }
    return this.rightChatHeader;
  }

  getLeftChatHeader(): ChatHeader {
    if (!this.leftChatHeader) {
      this.leftChatHeader = new ChatHeader(this.page, this.rootLocator);
    }
    return this.leftChatHeader;
  }

  public async getConversationsCount() {
    return (
      (await this.getLeftAgentInfo().getElementsCount()) +
      (await this.getRightAgentInfo().getElementsCount())
    );
  }

  public async getChatMessagesCount() {
    return this.getChatMessages().getElementsCount();
  }

  public async isConversationToCompareVisible() {
    return this.getConversationToCompare().isVisible();
  }

  public async waitForComparedConversationsLoaded() {
    await this.waitForState();
    await this.getRightChatHeader().waitForState();
    await this.getLeftChatHeader().waitForState();
    const chatMessages = this.getChatMessages().compareChatMessages;
    await chatMessages.getNthElement(0).waitFor();
    await chatMessages.getNthElement(1).waitFor();
  }
}

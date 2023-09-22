import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';
import { ChatMessages } from './chatMessages';
import { ConversationSettings } from './conversationSettings';
import { SendMessage } from './sendMessage';

import { ExpectedConstants } from '@/e2e/src/testData';
import { ChatHeader } from '@/e2e/src/ui/webElements/chatHeader';
import { Page } from '@playwright/test';

export class Chat extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.chat);
  }

  private chatHeader!: ChatHeader;
  private conversationSettings!: ConversationSettings;
  private sendMessage!: SendMessage;
  private chatMessages!: ChatMessages;
  private regenerate = new BaseElement(this.page, ChatSelectors.regenerate);
  public replay = new BaseElement(this.page, ChatSelectors.startReplay);
  public stopGenerating = new BaseElement(
    this.page,
    ChatSelectors.stopGenerating,
  );
  public proceedGenerating = new BaseElement(
    this.page,
    ChatSelectors.proceedGenerating,
  );

  getChatHeader(): ChatHeader {
    if (!this.chatHeader) {
      this.chatHeader = new ChatHeader(this.page);
    }
    return this.chatHeader;
  }

  getConversationSettings(): ConversationSettings {
    if (!this.conversationSettings) {
      this.conversationSettings = new ConversationSettings(this.page);
    }
    return this.conversationSettings;
  }

  getSendMessage(): SendMessage {
    if (!this.sendMessage) {
      this.sendMessage = new SendMessage(this.page);
    }
    return this.sendMessage;
  }

  getChatMessages(): ChatMessages {
    if (!this.chatMessages) {
      this.chatMessages = new ChatMessages(this.page);
    }
    return this.chatMessages;
  }

  public async sendRequest(message: string) {
    await this.getSendMessage().send(message);
    await this.waitForResponse(true);
  }

  public async regenerateResponse() {
    await this.regenerate.click();
    await this.waitForResponse(true);
  }

  public async startReplay(userRequest?: string, waitForAnswer = false) {
    await this.replay.waitForState();
    const requestPromise = userRequest
      ? this.page.waitForRequest((request) =>
          request.postData()!.includes(userRequest),
        )
      : this.page.waitForRequest(ExpectedConstants.chatAPIUrl);
    await this.replay.click();
    const request = await requestPromise;
    await this.waitForResponse(waitForAnswer);
    return request.postDataJSON();
  }

  public async stopReplay() {
    await this.stopGenerating.click();
    await this.proceedGenerating.waitForState();
  }

  public async proceedReplaying(waitForAnswer = false) {
    const requestPromise = this.page.waitForRequest(
      ExpectedConstants.chatAPIUrl,
    );
    await this.proceedGenerating.click();
    const request = await requestPromise;
    await this.waitForResponse(waitForAnswer);
    return request.postDataJSON();
  }

  public async waitForResponse(waitForAnswer = false) {
    if (waitForAnswer) {
      await this.getChatMessages().waitForResponseReceived();
    }
  }
}

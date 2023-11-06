import { ChatSelectors } from '../selectors';
import { BaseElement } from './baseElement';
import { ChatMessages } from './chatMessages';
import { ConversationSettings } from './conversationSettings';
import { SendMessage } from './sendMessage';

import { API } from '@/e2e/src/testData';
import { ChatHeader } from '@/e2e/src/ui/webElements/chatHeader';
import { Compare } from '@/e2e/src/ui/webElements/compare';
import { Page } from '@playwright/test';

export class Chat extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.chat);
  }

  private chatHeader!: ChatHeader;
  private conversationSettings!: ConversationSettings;
  private sendMessage!: SendMessage;
  private chatMessages!: ChatMessages;
  private compare!: Compare;
  public regenerate = new BaseElement(this.page, ChatSelectors.regenerate);
  public replay = new BaseElement(this.page, ChatSelectors.startReplay);
  public applyChanges = (index?: number) =>
    new BaseElement(this.page, ChatSelectors.applyChanges).getNthElement(
      index ?? 1,
    );
  public stopGenerating = new BaseElement(
    this.page,
    ChatSelectors.stopGenerating,
  );
  public proceedGenerating = new BaseElement(
    this.page,
    ChatSelectors.proceedGenerating,
  );
  public chatSpinner = this.getChildElementBySelector(ChatSelectors.spinner);

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
      this.sendMessage = new SendMessage(this.page, this.rootLocator);
    }
    return this.sendMessage;
  }

  getChatMessages(): ChatMessages {
    if (!this.chatMessages) {
      this.chatMessages = new ChatMessages(this.page);
    }
    return this.chatMessages;
  }

  getCompare(): Compare {
    if (!this.compare) {
      this.compare = new Compare(this.page);
    }
    return this.compare;
  }

  public async sendRequestWithKeyboard(message: string, waitForAnswer = true) {
    return this.sendRequest(
      message,
      () => this.getSendMessage().sendWithEnterKey(message),
      waitForAnswer,
    );
  }

  public async regenerateResponse(waitForAnswer = true) {
    await this.regenerate.click();
    await this.waitForResponse(waitForAnswer);
  }

  public async startReplay(userRequest?: string, waitForAnswer = false) {
    await this.replay.waitForState();
    const requestPromise = this.waitForRequestSent(userRequest);
    await this.replay.click();
    const request = await requestPromise;
    await this.waitForResponse(waitForAnswer);
    return request.postDataJSON();
  }

  public async startReplayForDifferentModels(userRequests: string[]) {
    await this.replay.waitForState();
    const requests = [];
    for (const req of userRequests) {
      const resp = this.waitForRequestSent(req);
      requests.push(resp);
    }
    await this.replay.click();
    for (const req of requests) {
      await req;
    }
    await this.waitForResponse(true);
  }

  public async sendRequestInCompareMode(
    message: string,
    comparedEntities: { rightEntity: string; leftEntity: string },
    waitForAnswer = false,
  ) {
    const rightRequestPromise = this.waitForRequestSent(
      comparedEntities.rightEntity,
    );
    const leftRequestPromise = this.waitForRequestSent(
      comparedEntities.leftEntity,
    );
    await this.getSendMessage().send(message);
    const rightRequest = await rightRequestPromise;
    const leftRequest = await leftRequestPromise;
    await this.waitForResponse(waitForAnswer);
    return {
      rightRequest: rightRequest.postDataJSON(),
      leftRequest: leftRequest.postDataJSON(),
    };
  }

  public waitForRequestSent(userRequest: string | undefined) {
    return userRequest
      ? this.page.waitForRequest((request) =>
          request.postData()!.includes(userRequest),
        )
      : this.page.waitForRequest(API.chatHost);
  }

  public async proceedReplaying(waitForAnswer = false) {
    const requestPromise = this.page.waitForRequest(API.chatHost);
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

  public async waitForChatLoaded() {
    await this.chatSpinner.waitForState({ state: 'detached' });
  }

  private async sendRequest(
    message: string,
    sendMethod: () => Promise<void>,
    waitForAnswer = true,
  ) {
    const requestPromise = this.waitForRequestSent(message);
    await sendMethod();
    const request = await requestPromise;
    await this.waitForResponse(waitForAnswer);
    return request.postDataJSON();
  }
  public async sendRequestWithButton(message: string, waitForAnswer = true) {
    return this.sendRequest(
      message,
      () => this.getSendMessage().send(message),
      waitForAnswer,
    );
  }
}

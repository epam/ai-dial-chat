import {
  ChatBarSelectors,
  ChatSelectors,
  SideBarSelectors,
} from '../selectors';
import { BaseElement } from './baseElement';

import { Chronology } from '@/e2e/src/testData';
import { keys } from '@/e2e/src/ui/keyboard';
import { DropdownMenu } from '@/e2e/src/ui/webElements/dropdownMenu';
import { Input } from '@/e2e/src/ui/webElements/input';
import { Page } from '@playwright/test';

interface ConversationsChronologyType {
  chronology: string;
  conversations: string[];
}

export class Conversations extends BaseElement {
  constructor(page: Page) {
    super(page, ChatBarSelectors.conversations);
  }

  public chronologyByTitle = (chronology: string) =>
    this.getChildElementBySelector(
      SideBarSelectors.chronology,
    ).getElementLocatorByText(chronology);

  public conversationDotsMenu = (name: string, index?: number) => {
    return this.getConversationByName(name, index).locator(
      SideBarSelectors.dotsMenu,
    );
  };

  private conversationInput!: Input;

  getConversationInput(name: string): Input {
    if (!this.conversationInput) {
      this.conversationInput = new Input(
        this.page,
        `${
          ChatBarSelectors.conversation
        } >> ${SideBarSelectors.renameDefaultNameInput(name)}`,
      );
    }
    return this.conversationInput;
  }

  private dropdownMenu!: DropdownMenu;

  getDropdownMenu(): DropdownMenu {
    if (!this.dropdownMenu) {
      this.dropdownMenu = new DropdownMenu(this.page);
    }
    return this.dropdownMenu;
  }

  public getConversationByName(name: string, index?: number) {
    return this.getChildElementBySelector(
      ChatBarSelectors.conversation,
    ).getElementLocatorByText(name, index);
  }

  public getConversationName(name: string, index?: number) {
    return this.createElementFromLocator(
      this.getConversationByName(name, index).locator(
        ChatBarSelectors.conversationName,
      ),
    );
  }

  public async getConversationsByChronology() {
    await this.waitForState({ state: 'attached' });
    const allConversations = await this.getElementInnerContent();
    const conversationsChronology: ConversationsChronologyType[] = [];
    const chronologyIndexes: number[] = [];

    const allConversationsArray = allConversations.split('\n');
    allConversationsArray.forEach((conv) => {
      const isChronology = Object.values(Chronology).includes(conv);
      if (isChronology) {
        conversationsChronology.push({
          chronology: conv,
          conversations: [],
        });
        chronologyIndexes.push(allConversationsArray.indexOf(conv));
      }
    });

    for (let i = 0; i < chronologyIndexes.length; i++) {
      const chronologyConversations = allConversationsArray.slice(
        chronologyIndexes[i] + 1,
        chronologyIndexes[i + 1],
      );
      chronologyConversations.forEach((conv) =>
        conversationsChronology[i].conversations.push(conv),
      );
    }
    return conversationsChronology;
  }

  public async getTodayConversations() {
    return this.getChronologyConversations(Chronology.today);
  }

  public async getYesterdayConversations() {
    return this.getChronologyConversations(Chronology.yesterday);
  }

  public async getLastWeekConversations() {
    return this.getChronologyConversations(Chronology.lastSevenDays);
  }

  public async getLastMonthConversations() {
    return this.getChronologyConversations(Chronology.lastThirtyDays);
  }

  public async getChronologyConversations(chronology: string) {
    const conversationsChronology = await this.getConversationsByChronology();
    return conversationsChronology.find(
      (chron) => chron.chronology === chronology,
    )!.conversations;
  }

  public async selectConversation(name: string, index?: number) {
    await this.getConversationByName(name, index).click();
  }

  public async openConversationDropdownMenu(name: string, index?: number) {
    const conversation = this.getConversationByName(name, index);
    await conversation.hover();
    await this.conversationDotsMenu(name, index).click();
    await this.getDropdownMenu().waitForState();
  }

  public async editConversationNameWithTick(name: string, newName: string) {
    const input = await this.openEditConversationNameMode(name, newName);
    await input.clickTickButton();
  }

  public async editConversationNameWithEnter(name: string, newName: string) {
    await this.openEditConversationNameMode(name, newName);
    await this.page.keyboard.press(keys.enter);
    await this.getConversationByName(name).waitFor({ state: 'hidden' });
  }

  public async openEditConversationNameMode(name: string, newName: string) {
    const input = await this.getConversationInput(name);
    await input.editValue(newName);
    return input;
  }

  public async getConversationIcon(name: string, index?: number) {
    const conversation = this.getConversationByName(name, index);
    return this.getElementIconHtml(conversation);
  }

  public async isConversationHasPlaybackIcon(name: string, index?: number) {
    const playBackIcon = await this.getConversationByName(name, index).locator(
      ChatSelectors.playbackIcon,
    );
    return playBackIcon.isVisible();
  }
}

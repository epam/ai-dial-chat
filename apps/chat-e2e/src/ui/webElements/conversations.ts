import { ChatBarSelectors, SideBarSelectors } from '../selectors';

import { Chronology } from '@/src/testData';
import { BaseConversation } from '@/src/ui/webElements/baseConversation';
import { Page } from '@playwright/test';

interface ConversationsChronologyType {
  chronology: string;
  conversations: string[];
}

export class Conversations extends BaseConversation {
  constructor(page: Page) {
    super(page, ChatBarSelectors.conversations, ChatBarSelectors.conversation);
  }

  public chronologyByTitle = (chronology: string) =>
    this.getChildElementBySelector(
      SideBarSelectors.chronology,
    ).getElementLocatorByText(chronology);

  public getConversationArrowIcon(name: string, index?: number) {
    return this.getEntityArrowIcon(this.entitySelector, name, index);
  }

  public getConversationArrowIconColor(name: string, index?: number) {
    return this.getEntityArrowIconColor(this.entitySelector, name, index);
  }

  public getConversationCheckbox(name: string, index?: number) {
    return this.getEntityCheckbox(this.entitySelector, name, index);
  }

  public async getConversationCheckboxState(name: string, index?: number) {
    return this.getEntityCheckboxState(this.entitySelector, name, index);
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
}

import {
  ChatBarSelectors,
  EntityTreeSelectors,
  SideBarSelectors,
} from '../../../selectors';

import { Chronology } from '@/src/testData';
import { BaseSideBarConversation } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

interface ConversationsChronologyType {
  chronology: string;
  conversations: string[];
}

export class Conversations extends BaseSideBarConversation {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      ChatBarSelectors.conversations,
      EntityTreeSelectors.conversation,
    );
  }

  public chronologyByTitle = (chronology: string) =>
    this.getChildElementBySelector(
      SideBarSelectors.chronology,
    ).getElementLocatorByText(chronology);

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

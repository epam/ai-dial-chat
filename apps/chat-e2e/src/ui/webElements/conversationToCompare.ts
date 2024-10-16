import {
  CompareSelectors,
  EntitySelectors,
  SideBarSelectors,
} from '../selectors';
import { BaseElement } from './baseElement';

import { Attributes, Styles, Tags } from '@/src/ui/domData';
import { Page } from '@playwright/test';

export class ConversationToCompare extends BaseElement {
  constructor(page: Page) {
    super(page, CompareSelectors.conversationToCompare);
  }

  public compareConversationRows = this.getChildElementBySelector(
    CompareSelectors.conversationRow,
  );

  public compareConversationRowNames = this.getChildElementBySelector(
    EntitySelectors.entityName,
  );

  public noConversationsAvailable = this.getChildElementBySelector(
    CompareSelectors.noConversationsAvailable,
  );

  public searchCompareConversationInput = this.getChildElementBySelector(
    CompareSelectors.searchCompareConversation,
  );

  public compareConversationRow = (name: string) =>
    this.compareConversationRows.getElementLocatorByText(name);

  public compareConversationRowName = (name: string) =>
    this.createElementFromLocator(
      this.compareConversationRowNames.getElementLocatorByText(name),
    );

  public getCompareConversationAdditionalIcon(name: string) {
    return this.compareConversationRow(name).locator(
      SideBarSelectors.arrowAdditionalIcon,
    );
  }

  public getCompareConversationArrowIconColor(name: string) {
    return this.createElementFromLocator(
      this.getCompareConversationAdditionalIcon(name).locator(Tags.svg),
    ).getComputedStyleProperty(Styles.color);
  }

  public async getCompareConversationNames() {
    return this.compareConversationRowNames.getElementsInnerContent();
  }

  public async selectCompareConversation(
    name: string,
    { isHttpMethodTriggered = true }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    if (isHttpMethodTriggered) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'GET',
      );
      await this.compareConversationRow(name).click();
      return respPromise;
    }
    await this.compareConversationRow(name).click();
  }

  public async getCompareConversationIcons() {
    return this.getElementIcons(this.compareConversationRows, Attributes.title);
  }

  public showAllConversationsCheckbox = this.getChildElementBySelector(
    CompareSelectors.showAllCheckbox,
  );

  public async checkShowAllConversations() {
    if (await this.showAllConversationsCheckbox.isVisible()) {
      await this.showAllConversationsCheckbox.click();
    }
  }
}

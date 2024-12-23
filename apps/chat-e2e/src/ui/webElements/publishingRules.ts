import { PublishingRulesSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class PublishingRules extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, PublishingRulesSelectors.rulesContainer, parentLocator);
  }

  public publishingPath = this.getChildElementBySelector(
    PublishingRulesSelectors.path,
  );
  public rulesList = this.getChildElementBySelector(
    PublishingRulesSelectors.rulesList,
  );
  public addRuleButton = this.rulesList.getChildElementBySelector(
    PublishingRulesSelectors.addRuleButton,
  );
  public allRules = this.rulesList.getChildElementBySelector(
    PublishingRulesSelectors.rule,
  );
}

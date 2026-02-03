import { PublicationFunctions } from '@/chat/types/publication';
import { BooleanOperator, PublishingRulesFilterTarget } from '@/src/testData';
import { AttributeValues } from '@/src/ui/domData';
import { IconSelectors, PublishingRulesSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Button } from '@/src/ui/webElements/common/button';
import { PublishingFilter } from '@/src/ui/webElements/publishingFilter';
import { Locator, Page } from '@playwright/test';

export class PublishingRules extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, PublishingRulesSelectors.rulesContainer, parentLocator);
  }

  public publishingFilter!: PublishingFilter;

  gePublishingFilter(): PublishingFilter {
    if (!this.publishingFilter) {
      this.publishingFilter = new PublishingFilter(this.page, this.rootLocator);
    }
    return this.publishingFilter;
  }

  public allowAccessLabel = this.getChildElementBySelector(
    PublishingRulesSelectors.allowAccessLabel,
  );
  public availabilityLabel = this.getChildElementBySelector(
    PublishingRulesSelectors.availabilityLabel,
  );
  public seeChangesButton = this.getChildElementBySelector(
    PublishingRulesSelectors.seeChangesButton,
  );
  public noChangesLabel = this.getChildElementBySelector(
    PublishingRulesSelectors.noChangesLabel,
  );

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
  public cancelAllRules = new Button(
    this.page,
    AttributeValues.cancelAllRules,
    this.rootLocator,
  );

  public rule = (rule: {
    target: PublishingRulesFilterTarget;
    fnc: PublicationFunctions;
    values: string[];
  }) => {
    let ruleLocator = this.allRules
      .getElementLocator()
      .filter({
        has: new BaseElement(
          this.page,
          PublishingRulesSelectors.ruleTarget,
        ).getElementLocatorByText(new RegExp(`^${rule.target}$`)),
      })
      .filter({
        has: new BaseElement(
          this.page,
          PublishingRulesSelectors.ruleFunction,
        ).getElementLocatorByText(new RegExp(`^${rule.fnc.toLowerCase()}$`)),
      });

    for (let i = 0; i < rule.values.length; i++) {
      const valueCondition = new BaseElement(
        this.page,
        PublishingRulesSelectors.ruleValue,
      ).getElementLocatorByText(new RegExp(`^${rule.values[i]}$`));
      ruleLocator = ruleLocator.filter({ has: valueCondition });
      if (i !== rule.values.length - 1) {
        const operatorCondition = new BaseElement(
          this.page,
          PublishingRulesSelectors.ruleInnerOperator,
        ).getElementLocatorByText(new RegExp(`^${BooleanOperator.or}$`), i + 1);
        ruleLocator = ruleLocator.filter({ has: operatorCondition });
      }
    }
    return ruleLocator;
  };

  public cancelRuleButton = (rule: {
    target: PublishingRulesFilterTarget;
    fnc: PublicationFunctions;
    values: string[];
  }) => this.rule(rule).locator(IconSelectors.cancelIcon);

  public ruleOperator = (rule: {
    target: PublishingRulesFilterTarget;
    fnc: PublicationFunctions;
    values: string[];
  }) => this.rule(rule).locator(PublishingRulesSelectors.ruleOperator);
}

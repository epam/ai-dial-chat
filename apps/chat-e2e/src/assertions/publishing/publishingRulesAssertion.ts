import { PublicationFunctions } from '@/chat/types/publication';
import { BaseAssertion } from '@/src/assertions';
import {
  BooleanOperator,
  ElementState,
  PublishingRulesFilterTarget,
} from '@/src/testData';
import { PublishingRules } from '@/src/ui/webElements';

export class PublishingRulesAssertion extends BaseAssertion {
  readonly publishingRules: PublishingRules;

  constructor(publishingRules: PublishingRules) {
    super();
    this.publishingRules = publishingRules;
  }

  public async assertFilterFields(fieldsToVerify: {
    filterTargetState?: ElementState;
    filterTargetValue?: PublishingRulesFilterTarget | string;
    filterFunctionState?: ElementState;
    filterFunctionValue?: PublicationFunctions | string;
    filterValues?: string[];
    saveButtonState?: ElementState;
    cancelButtonState?: ElementState;
  }) {
    const publishingFilter = this.publishingRules.gePublishingFilter();
    if (fieldsToVerify.filterTargetState) {
      await this.assertElementState(
        publishingFilter.filterTarget,
        fieldsToVerify.filterTargetState,
      );
    }
    if (fieldsToVerify.filterTargetValue) {
      await this.assertElementText(
        publishingFilter.filterTarget,
        fieldsToVerify.filterTargetValue,
      );
    }
    if (fieldsToVerify.filterFunctionState) {
      await this.assertElementState(
        publishingFilter.filterFunction,
        fieldsToVerify.filterFunctionState,
      );
    }
    if (fieldsToVerify.filterFunctionValue) {
      await this.assertElementText(
        publishingFilter.filterFunction,
        fieldsToVerify.filterFunctionValue,
      );
    }
    if (fieldsToVerify.filterValues) {
      await this.assertElementInnerText(
        publishingFilter.filterPills,
        fieldsToVerify.filterValues,
      );
    }
    if (fieldsToVerify.saveButtonState) {
      await this.assertElementState(
        publishingFilter.saveFilterButton,
        fieldsToVerify.saveButtonState,
      );
    }
    if (fieldsToVerify.cancelButtonState) {
      await this.assertElementState(
        publishingFilter.cancelFilterButton,
        fieldsToVerify.cancelButtonState,
      );
    }
  }

  public async assertRule(
    rule: {
      target: PublishingRulesFilterTarget;
      fnc: PublicationFunctions;
      values: string[];
    },
    expectedState: ElementState,
    expectedOperator?: BooleanOperator,
  ) {
    await this.assertElementState(
      this.publishingRules.rule(rule),
      expectedState,
    );
    if (expectedState === 'visible') {
      await this.assertElementState(
        this.publishingRules.cancelRuleButton(rule),
        'visible',
      );
    }
    if (expectedOperator) {
      await this.assertElementText(
        this.publishingRules.ruleOperator(rule),
        expectedOperator,
      );
    }
  }
}

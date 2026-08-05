import { PublicationFunctions } from '@/chat/types/publication';
import { getFilterLabel } from '@/chat/utils/app/rules';
import { BaseAssertion } from '@/src/assertions';
import {
  BooleanOperator,
  ElementState,
  ExpectedConstants,
  PublishingRulesFilterTarget,
} from '@/src/testData';
import { PublishingRules } from '@/src/ui/webElements';

export class PublishingRulesAssertion extends BaseAssertion {
  readonly publishingRules: PublishingRules;

  constructor(publishingRules: PublishingRules) {
    super();
    this.publishingRules = publishingRules;
  }

  public async assertLabels(labelsToVerify: {
    publishPath?: string;
    allowAccessLabel?: ElementState;
    availabilityLabel?: ElementState;
    noChangesLabel?: ElementState;
    seeChangesButton?: ElementState;
  }) {
    if (labelsToVerify.publishPath) {
      // Format the expected path as "Organization / {folderName}" to match the display format
      const expectedPath = `Organization / ${labelsToVerify.publishPath}`;
      await this.assertElementText(
        this.publishingRules.publishingPath,
        expectedPath,
      );
    }
    if (labelsToVerify.allowAccessLabel) {
      await this.assertElementState(
        this.publishingRules.allowAccessLabel,
        labelsToVerify.allowAccessLabel,
      );
      if (labelsToVerify.allowAccessLabel === 'visible') {
        await this.assertElementText(
          this.publishingRules.allowAccessLabel,
          ExpectedConstants.allowAccessLabel,
        );
      }
    }
    if (labelsToVerify.availabilityLabel) {
      await this.assertElementState(
        this.publishingRules.availabilityLabel,
        labelsToVerify.availabilityLabel,
      );
      if (labelsToVerify.availabilityLabel === 'visible') {
        await this.assertElementText(
          this.publishingRules.availabilityLabel,
          ExpectedConstants.availabilityLabel,
        );
      }
    }
    if (labelsToVerify.seeChangesButton) {
      await this.assertElementState(
        this.publishingRules.seeChangesButton,
        labelsToVerify.seeChangesButton,
      );
      if (labelsToVerify.seeChangesButton === 'visible') {
        await this.assertElementText(
          this.publishingRules.seeChangesButton,
          ExpectedConstants.seeChangesLabel,
        );
      }
    }
    if (labelsToVerify.noChangesLabel) {
      await this.assertElementState(
        this.publishingRules.noChangesLabel,
        labelsToVerify.noChangesLabel,
      );
      if (labelsToVerify.noChangesLabel === 'visible') {
        await this.assertElementText(
          this.publishingRules.noChangesLabel,
          ExpectedConstants.noChangesLabel,
        );
      }
    }
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
      const value = getFilterLabel(fieldsToVerify.filterFunctionValue);
      const expectedValue = Object.values(PublicationFunctions).includes(
        fieldsToVerify.filterFunctionValue as PublicationFunctions,
      )
        ? value
        : fieldsToVerify.filterFunctionValue;
      await this.assertElementText(
        publishingFilter.filterFunction,
        expectedValue,
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
    expectedCancelButtonState: ElementState,
    expectedOperator?: BooleanOperator,
  ) {
    await this.assertElementState(
      this.publishingRules.rule(rule),
      expectedState,
    );
    if (expectedOperator) {
      await this.assertElementText(
        this.publishingRules.ruleOperator(rule),
        expectedOperator,
      );
    } else {
      await this.assertElementState(
        this.publishingRules.ruleOperator(rule),
        'hidden',
      );
    }
    if (expectedCancelButtonState) {
      await this.assertElementState(
        this.publishingRules.cancelRuleButton(rule),
        expectedCancelButtonState,
      );
    }
  }
}

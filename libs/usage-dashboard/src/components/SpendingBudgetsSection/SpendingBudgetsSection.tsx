import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Notification,
  NotificationType,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import { FC, useId } from 'react';
import { USAGE_DASHBOARD_CLASS } from '../../constants/public-class-names';
import {
  SpendingBudgetData,
  SpendingBudgetsSectionProps,
} from '../../models/spending-budgets-props';
import { UsageLimitCardGroup } from '../UsageLimitCardGroup/UsageLimitCardGroup';
import styles from './SpendingBudgetsSection.module.scss';

interface BudgetGroupProps {
  budget: SpendingBudgetData;
  titleClassName: string;
  coverageClassName: string;
  cardLabels: SpendingBudgetsSectionProps['cardLabels'];
  cardStyles: NonNullable<SpendingBudgetsSectionProps['styles']>['cards'];
}

const BudgetGroup: FC<BudgetGroupProps> = ({
  budget,
  titleClassName,
  coverageClassName,
  cardLabels,
  cardStyles,
}) => {
  const titleId = useId();

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      className={mergeClasses(
        'flex flex-col gap-3',
        USAGE_DASHBOARD_CLASS.budget,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <h3
          id={titleId}
          className={mergeClasses('m-0', titleClassName, styles.title)}
        >
          {budget.title}
        </h3>
        {budget.coverageLabel != null && (
          <p
            className={mergeClasses('m-0', coverageClassName, styles.coverage)}
          >
            {budget.coverageLabel}
          </p>
        )}
      </div>
      <UsageLimitCardGroup
        cards={budget.cards}
        labels={cardLabels}
        styles={cardStyles}
      />
    </div>
  );
};

/** Lists spending budgets, each with its title, model coverage and period cards, under one heading. */
export const SpendingBudgetsSection: FC<SpendingBudgetsSectionProps> = ({
  budgets,
  labels,
  cardLabels,
  styles: stylesProp,
}) => {
  const headingId = useId();
  const { colors, typography, cards: cardStyles } = stylesProp ?? {};
  const {
    headingClassName = 'dial-h3-text',
    descriptionClassName = 'dial-small-text',
    titleClassName = 'dial-body-semi-text',
    coverageClassName = 'dial-small-text',
  } = typography ?? {};

  if (budgets.length === 0 && labels.emptyStateLabel == null) {
    return null;
  }

  const cssVars = buildCssVars({
    '--uld-budgets-heading': colors?.headingColor,
    '--uld-budgets-description': colors?.descriptionColor,
    '--uld-budgets-title': colors?.titleColor,
    '--uld-budgets-coverage': colors?.coverageColor,
  });

  return (
    <section
      aria-labelledby={headingId}
      className={mergeClasses(
        'flex flex-col gap-4',
        USAGE_DASHBOARD_CLASS.budgets,
      )}
      style={cssVars}
    >
      <div className="flex flex-col gap-0.5">
        <h2
          id={headingId}
          className={mergeClasses('m-0', headingClassName, styles.heading)}
        >
          {labels.headingLabel}
        </h2>
        {labels.descriptionLabel != null && (
          <p
            className={mergeClasses(
              'm-0',
              descriptionClassName,
              styles.description,
            )}
          >
            {labels.descriptionLabel}
          </p>
        )}
      </div>
      {labels.noticeLabel != null && (
        <Notification
          variant={NotificationVariant.Info}
          type={NotificationType.SectionMessage}
          message={labels.noticeLabel}
          role="note"
        />
      )}
      {budgets.length === 0 ? (
        <p
          className={mergeClasses(
            'm-0',
            descriptionClassName,
            styles.description,
          )}
        >
          {labels.emptyStateLabel}
        </p>
      ) : (
        budgets.map((budget) => (
          <BudgetGroup
            key={budget.id}
            budget={budget}
            titleClassName={titleClassName}
            coverageClassName={coverageClassName}
            cardLabels={cardLabels}
            cardStyles={cardStyles}
          />
        ))
      )}
    </section>
  );
};

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { USAGE_DASHBOARD_CLASS } from '../../../constants/public-class-names';
import type {
  SpendingBudgetData,
  SpendingBudgetsSectionProps,
} from '../../../models/spending-budgets-props';
import {
  UsageLimitCardData,
  UsageLimitCardGroupLabels,
  UsageLimitStatus,
} from '../../../models/usage-limit-card-props';
import { SpendingBudgetsSection } from '../SpendingBudgetsSection';

const cardLabels: UsageLimitCardGroupLabels = {
  defaultBadgeLabel: 'Within limits',
  runningLowBadgeLabel: 'Running low',
  limitReachedBadgeLabel: 'Limit reached',
  usedOfTotalLabel: ({ total }) => `used of ${total}`,
  remainingCaptionLabel: ({ remaining }) => `${remaining} left`,
  usedPercentLabel: ({ percent }) => `${percent}%`,
};

const card = (title: string): UsageLimitCardData => ({
  title,
  periodDescription: title,
  used: 1,
  total: 10,
  usedLabel: '$1.00',
  totalLabel: '$10.00',
  remainingLabel: '$9.00',
  usedPercent: 10,
  status: UsageLimitStatus.Default,
  progressAriaLabel: `${title} progress`,
});

const budgets: SpendingBudgetData[] = [
  {
    id: 'org',
    title: 'Organization-wide',
    coverageLabel: 'All models',
    cards: [card('Today'), card('This month')],
  },
  {
    id: 'team',
    title: 'Team',
    cards: [card('Today'), card('This month')],
  },
];

const renderSection = (props: Partial<SpendingBudgetsSectionProps> = {}) =>
  render(
    <SpendingBudgetsSection
      budgets={budgets}
      labels={{ headingLabel: 'Budgets' }}
      cardLabels={cardLabels}
      {...props}
    />,
  );

describe('SpendingBudgetsSection', () => {
  it('renders a section named by its heading', () => {
    renderSection();

    const section = screen.getByRole('region', { name: 'Budgets' });
    expect(
      within(section).getByRole('heading', { level: 2, name: 'Budgets' }),
    ).toBeTruthy();
    expect(section.classList.contains(USAGE_DASHBOARD_CLASS.budgets)).toBe(
      true,
    );
  });

  it('renders one named group per budget in array order', () => {
    renderSection();

    // Each card is a group of its own, so only the budget groups are compared.
    const groups = screen
      .getAllByRole('group')
      .filter((group) =>
        group.classList.contains(USAGE_DASHBOARD_CLASS.budget),
      );
    expect(groups).toHaveLength(2);
    expect(screen.getByRole('group', { name: 'Organization-wide' })).toBe(
      groups[0],
    );
    expect(screen.getByRole('group', { name: 'Team' })).toBe(groups[1]);
    expect(
      within(groups[0]).getByRole('heading', {
        level: 3,
        name: 'Organization-wide',
      }),
    ).toBeTruthy();
    expect(groups[0].classList.contains(USAGE_DASHBOARD_CLASS.budget)).toBe(
      true,
    );
  });

  it('renders the coverage line only when given', () => {
    renderSection();

    expect(
      within(
        screen.getByRole('group', { name: 'Organization-wide' }),
      ).getByText('All models'),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('group', { name: 'Team' })).queryByText(
        'All models',
      ),
    ).toBeNull();
  });

  it("renders each budget's cards", () => {
    renderSection();

    const team = screen.getByRole('group', { name: 'Team' });
    expect(within(team).getByText('Today')).toBeTruthy();
    expect(within(team).getByText('This month')).toBeTruthy();
  });

  it('renders the description and notice when given', () => {
    renderSection({
      labels: {
        headingLabel: 'Budgets',
        descriptionLabel: 'Charged in this order.',
        noticeLabel: 'Not enforced yet.',
      },
    });

    expect(screen.getByText('Charged in this order.')).toBeTruthy();
    const notice = screen.getByRole('note');
    expect(within(notice).getByText('Not enforced yet.')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders the heading and empty-state text for an empty list with an empty-state label', () => {
    renderSection({
      budgets: [],
      labels: { headingLabel: 'Budgets', emptyStateLabel: 'No budget.' },
    });

    expect(screen.getByRole('heading', { name: 'Budgets' })).toBeTruthy();
    expect(screen.getByText('No budget.')).toBeTruthy();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('renders nothing for an empty list without an empty-state label', () => {
    renderSection({ budgets: [] });

    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('applies color overrides as CSS custom properties', () => {
    renderSection({
      styles: { colors: { titleColor: '#123456', headingColor: '#654321' } },
    });

    const section = screen.getByRole('region', { name: 'Budgets' });
    expect(section.style.getPropertyValue('--uld-budgets-title')).toBe(
      '#123456',
    );
    expect(section.style.getPropertyValue('--uld-budgets-heading')).toBe(
      '#654321',
    );
  });

  it('applies typography overrides in place of the defaults', () => {
    renderSection({
      styles: { typography: { titleClassName: 'dial-h2-text' } },
    });

    const title = screen.getByRole('heading', {
      level: 3,
      name: 'Organization-wide',
    });
    expect(title.classList.contains('dial-h2-text')).toBe(true);
    expect(title.classList.contains('dial-body-semi-text')).toBe(false);
  });

  it('forwards card styles to every card', () => {
    renderSection({
      styles: { cards: { colors: { cardBackground: '#abcdef' } } },
    });

    const cards = screen
      .getAllByRole('group')
      .filter((group) => group.classList.contains(USAGE_DASHBOARD_CLASS.card));
    expect(cards).toHaveLength(4);
    for (const element of cards) {
      expect(element.style.getPropertyValue('--uld-card-bg')).toBe('#abcdef');
    }
  });
});

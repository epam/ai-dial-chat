import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  ExtensionServiceItem,
  ExtensionsLabels,
} from '../../../models/extensions-props';
import { ExtensionsSection } from '../ExtensionsSection';
import styles from '../ExtensionsSection.module.scss';

const labels: ExtensionsLabels = {
  tableAriaLabel: 'Extensions',
  nameColumnLabel: 'Name',
  descriptionColumnLabel: 'Description',
  actionsColumnLabel: 'Actions',
};

const makeRow = (
  overrides?: Partial<ExtensionServiceItem>,
): ExtensionServiceItem => ({
  id: 'dial-native',
  displayName: 'DIAL Scheduler',
  description: 'Connect the scheduler to run tasks on a timetable.',
  isWarningVisible: false,
  action: <button type="button">Log in</button>,
  ...overrides,
});

const renderSection = (rows?: ExtensionServiceItem[]) =>
  render(<ExtensionsSection rows={rows ?? [makeRow()]} labels={labels} />);

describe('ExtensionsSection', () => {
  it('renders the table with its accessible name', () => {
    renderSection();

    expect(screen.getByRole('table', { name: 'Extensions' })).toBeTruthy();
  });

  it('renders the Name and Description column headers', () => {
    renderSection();

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeTruthy();
    expect(
      screen.getByRole('columnheader', { name: 'Description' }),
    ).toBeTruthy();
  });

  it('renders the Actions column header as screen-reader-only text', () => {
    renderSection();

    const actionsHeader = screen.getByRole('columnheader', {
      name: 'Actions',
    });
    expect(actionsHeader.textContent).toBe('Actions');
    expect(screen.getByText('Actions', { selector: '.sr-only' })).toBeTruthy();
  });

  it('renders each service display name, description, and trailing action', () => {
    renderSection();

    expect(screen.getByText('DIAL Scheduler')).toBeTruthy();
    expect(
      screen.getByText('Connect the scheduler to run tasks on a timetable.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy();
  });

  it('renders the decorative warning glyph only when the service is disconnected', () => {
    /* The glyph is aria-hidden decoration (no semantic query reaches it),
     * so its presence is asserted at the CSS-class level. */
    const { container, rerender } = renderSection();

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector(`.${styles.warningBadge}`)).toBeNull();

    rerender(
      <ExtensionsSection
        rows={[makeRow({ isWarningVisible: true })]}
        labels={labels}
      />,
    );

    /* The glyph is decoration (the row's action carries the state), so its
     * presence is asserted at the CSS level — no semantic query applies. */
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector(`.${styles.warningBadge}`)).toBeTruthy();
  });

  it('applies the host-pinned avatar colour when one is supplied', () => {
    /* CSS-level assertion: the pinned palette pair lands on the aria-hidden
     * avatar badge's classes — no semantic query reaches a colour class. */

    const { container } = renderSection([
      makeRow({
        avatarColor: {
          background: 'bg-violet-1',
          foreground: 'text-violet-2',
        },
      }),
    ]);

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('.bg-violet-1')).toBeTruthy();
  });

  it('replaces the trailing action with the limited-access badge when its label is supplied', () => {
    renderSection([
      makeRow({
        isWarningVisible: true,
        limitedAccessLabel: 'Limited access',
        limitedAccessTooltipTitle: 'Limited access.',
        limitedAccessTooltipDescription:
          'Contact your administrator for more details.',
      }),
    ]);

    expect(screen.getByText('Limited access')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Log in' })).toBeNull();
  });

  it('shows the limited-access explanation without hover and associates it with the badge', () => {
    renderSection([
      makeRow({
        isWarningVisible: true,
        limitedAccessLabel: 'Limited access',
        limitedAccessTooltipTitle: 'Limited access.',
        limitedAccessTooltipDescription:
          'Contact your administrator for more details.',
      }),
    ]);

    /* The badge is not a control. Its explanation must be visible without
     * hover so sighted keyboard and touch users can read it too. */
    const description = screen.getByText(
      'Contact your administrator for more details.',
    );
    expect(description.className).not.toContain('sr-only');
    /* ARIA wiring has no semantic query — the badge is matched by walking up
     * from its label text to the element that carries the attribute. */
    /* eslint-disable testing-library/no-node-access */
    const badge = screen
      .getByText('Limited access')
      .closest('[aria-describedby]');
    expect(badge?.getAttribute('aria-describedby')).toBe(description.id);
    /* eslint-enable testing-library/no-node-access */
  });

  it('renders multiple rows in display order', () => {
    renderSection([
      makeRow({ id: 'first', displayName: 'First service' }),
      makeRow({ id: 'second', displayName: 'Second service' }),
    ]);

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3); // header + two service rows
    expect(screen.getByText('First service')).toBeTruthy();
    expect(screen.getByText('Second service')).toBeTruthy();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  ExtensionServiceItem,
  ExtensionsLabels,
} from '../../../models/extensions-props';
import { ExtensionsSection } from '../ExtensionsSection';

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
  authorizeLabel: 'Connect the DIAL Scheduler service',
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

  it('renders the warning badge with its accessible name only when the service is disconnected', () => {
    const { rerender } = renderSection();

    expect(
      screen.queryByRole('img', { name: 'Connect the DIAL Scheduler service' }),
    ).toBeNull();

    rerender(
      <ExtensionsSection
        rows={[makeRow({ isWarningVisible: true })]}
        labels={labels}
      />,
    );

    expect(
      screen.getByRole('img', { name: 'Connect the DIAL Scheduler service' }),
    ).toBeTruthy();
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

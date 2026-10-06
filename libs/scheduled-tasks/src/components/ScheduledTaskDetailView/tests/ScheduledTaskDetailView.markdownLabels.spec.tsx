import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScheduledTaskDetailViewLabels } from '../../../models/scheduled-task-detail-view-props';
import { ScheduledTaskRunStatus } from '../../../types/scheduled-task-run-status';
import { ScheduledTaskDetailView } from '../ScheduledTaskDetailView';

/* jsdom has no layout; report every table as wider than its scroll container
 * so `MarkdownTable` exposes its labelled scroll region. */
const mockOverflowingTables = () => {
  vi.spyOn(HTMLDivElement.prototype, 'scrollWidth', 'get').mockReturnValue(400);
  vi.spyOn(HTMLDivElement.prototype, 'clientWidth', 'get').mockReturnValue(200);
  vi.spyOn(HTMLDivElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    right: 200,
  } as DOMRect);
  vi.spyOn(HTMLTableElement.prototype, 'getBoundingClientRect').mockReturnValue(
    { left: 0, right: 400 } as DOMRect,
  );
};

const labels: ScheduledTaskDetailViewLabels = {
  backAriaLabel: 'Back',
  editButtonLabel: 'Edit',
  deleteButtonLabel: 'Delete',
  deletedStateLabel: 'Deleted',
  errorLabel: 'Failed to load the scheduled task',
  detailsTitle: 'Details',
  descriptionLabel: 'Description',
  modelLabel: 'Model or Agent',
  repeatsLabel: 'Repeats',
  activeWindowLabel: 'Active',
  activeStatusLabel: 'Active',
  completedFieldLabel: 'Status',
  configurationTitle: 'Configuration',
  instructionsLabel: 'Instructions',
  retryLabel: 'Retry',
  historyTitle: 'History',
  historyEmptyLabel: 'No runs yet',
  historyErrorLabel: 'Failed to load history',
  historyRetryLabel: 'Retry',
  runStatusLabels: {
    [ScheduledTaskRunStatus.Success]: 'Succeeded',
    [ScheduledTaskRunStatus.Error]: 'Failed',
    [ScheduledTaskRunStatus.InProgress]: 'Running',
    [ScheduledTaskRunStatus.Missed]: 'Missed',
  },
  codeBlockCopyLabel: 'Kopieren',
  codeBlockDownloadLabel: 'Herunterladen',
  tableScrollRegionAriaLabel: 'Scrollbare Tabelle',
};

/* Uses the real kit and `MDMessageViewer` (the main spec mocks both) so the
 * assertions cover the built-in fallback viewer down to the rendered elements. */
describe('ScheduledTaskDetailView — built-in instructions viewer labels', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('names the instructions code-block buttons with the labels from `labels`', () => {
    render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        displayName="Daily summary"
        instructionsMarkdown={'```ts\nconst a = 1;\n```'}
        runs={[]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Kopieren' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Herunterladen' })).toBeTruthy();
  });

  it('names an overflowing instructions table scroll region with the label from `labels`', () => {
    mockOverflowingTables();
    render(
      <ScheduledTaskDetailView
        labels={labels}
        onBack={vi.fn()}
        displayName="Daily summary"
        instructionsMarkdown={'| a | b |\n| - | - |\n| 1 | 2 |'}
        runs={[]}
      />,
    );

    expect(
      screen.getByRole('region', { name: 'Scrollbare Tabelle' }),
    ).toBeTruthy();
  });
});

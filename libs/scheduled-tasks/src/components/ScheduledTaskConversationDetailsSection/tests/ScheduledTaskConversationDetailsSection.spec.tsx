import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ScheduledTaskConversationDetailsSection,
  ScheduledTaskConversationDetailsState,
} from '../ScheduledTaskConversationDetailsSection';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  Accordion: ({
    title,
    expanded,
    onToggle,
    children,
  }: {
    title: ReactNode;
    expanded?: boolean;
    onToggle?: (expanded: boolean) => void;
    children?: ReactNode;
  }) => (
    <div>
      <button aria-expanded={expanded} onClick={() => onToggle?.(!expanded)}>
        {title}
      </button>
      <div>{children}</div>
    </div>
  ),
  GhostButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick?: () => void;
  }) => <button onClick={onClick}>{label}</button>,
}));

vi.mock(
  '../../ScheduledTaskDetailsSummary/ScheduledTaskDetailsSummary',
  () => ({
    ScheduledTaskDetailsSummary: ({
      modelLabel,
      modelDisplayName,
      skillLabel,
      skillDisplayNames,
      instructionsLabel,
      instructionsMarkdown,
      markdownLabels,
    }: {
      modelLabel: string;
      modelDisplayName?: string;
      skillLabel?: string;
      skillDisplayNames?: string[];
      instructionsLabel: string;
      instructionsMarkdown?: string;
      markdownLabels?: {
        codeBlockCopyLabel?: string;
        codeBlockCopiedLabel?: string;
        codeBlockDownloadLabel?: string;
        tableScrollRegionAriaLabel?: string;
        mathScrollRegionAriaLabel?: string;
      };
    }) => (
      <div>
        {modelDisplayName && <p>{`${modelLabel}: ${modelDisplayName}`}</p>}
        {skillDisplayNames?.map((name) => (
          <p key={name}>{`${skillLabel}: ${name}`}</p>
        ))}
        {instructionsMarkdown && (
          <p>{`${instructionsLabel}: ${instructionsMarkdown}`}</p>
        )}
        {markdownLabels && (
          <p>
            {`${markdownLabels.codeBlockCopyLabel}/${markdownLabels.codeBlockCopiedLabel}/${markdownLabels.codeBlockDownloadLabel}`}
          </p>
        )}
      </div>
    ),
  }),
);

const labels = {
  title: 'Details',
  modelLabel: 'Model',
  instructionsLabel: 'Instructions',
  skillLabel: 'Skill',
  unavailableLabel: 'Task details are unavailable',
  retryLabel: 'Retry',
};

describe('ScheduledTaskConversationDetailsSection', () => {
  it('renders the Details accordion collapsed by default', () => {
    render(
      <ScheduledTaskConversationDetailsSection
        scheduleId="schedule-1"
        state={ScheduledTaskConversationDetailsState.Ready}
        labels={labels}
      />,
    );

    const detailsButton = screen.getByRole('button', { name: 'Details' });
    expect(detailsButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('resets to collapsed when the schedule changes while expanded', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ScheduledTaskConversationDetailsSection
        scheduleId="schedule-1"
        state={ScheduledTaskConversationDetailsState.Ready}
        labels={labels}
      />,
    );

    const detailsButton = screen.getByRole('button', { name: 'Details' });
    await user.click(detailsButton);
    expect(detailsButton.getAttribute('aria-expanded')).toBe('true');

    rerender(
      <ScheduledTaskConversationDetailsSection
        scheduleId="schedule-2"
        state={ScheduledTaskConversationDetailsState.Ready}
        labels={labels}
      />,
    );
    expect(detailsButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows the summary with the supplied values once expanded', async () => {
    const user = userEvent.setup();
    render(
      <ScheduledTaskConversationDetailsSection
        scheduleId="schedule-1"
        state={ScheduledTaskConversationDetailsState.Ready}
        modelDisplayName="GPT-5"
        skillDisplayNames={['Weekly digest skill', 'Report skill']}
        instructionsMarkdown="Do the thing"
        labels={labels}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Details' }));

    expect(screen.getByText('Model: GPT-5')).toBeTruthy();
    expect(screen.getByText('Skill: Weekly digest skill')).toBeTruthy();
    expect(screen.getByText('Skill: Report skill')).toBeTruthy();
    expect(screen.getByText('Instructions: Do the thing')).toBeTruthy();
  });

  it('forwards the supplied markdown labels to the summary, omitting them otherwise', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ScheduledTaskConversationDetailsSection
        scheduleId="schedule-1"
        state={ScheduledTaskConversationDetailsState.Ready}
        instructionsMarkdown="Do the thing"
        labels={labels}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.queryByText('Copy/Copied/Download')).toBeNull();

    rerender(
      <ScheduledTaskConversationDetailsSection
        scheduleId="schedule-1"
        state={ScheduledTaskConversationDetailsState.Ready}
        instructionsMarkdown="Do the thing"
        markdownLabels={{
          codeBlockCopyLabel: 'Kopiuj',
          codeBlockCopiedLabel: 'Skopiowano',
          codeBlockDownloadLabel: 'Pobierz',
        }}
        labels={labels}
      />,
    );
    expect(screen.getByText('Kopiuj/Skopiowano/Pobierz')).toBeTruthy();
  });

  it('shows the unavailable message with retry wired to onRetry when the details fetch failed', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <ScheduledTaskConversationDetailsSection
        scheduleId="schedule-1"
        state={ScheduledTaskConversationDetailsState.Error}
        onRetry={onRetry}
        labels={labels}
      />,
    );

    expect(screen.getByRole('alert').textContent).toBe(
      'Task details are unavailable',
    );
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows the unavailable message without a retry action when details are unavailable', () => {
    render(
      <ScheduledTaskConversationDetailsSection
        scheduleId="schedule-1"
        state={ScheduledTaskConversationDetailsState.Unavailable}
        labels={labels}
      />,
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});

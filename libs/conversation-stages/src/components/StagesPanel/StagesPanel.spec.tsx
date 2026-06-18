import { StageStatus } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StagesPanel } from './StagesPanel';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DialSpinner: () => <span role="status" aria-label="Stage loading" />,
  DialEllipsisTooltip: ({ text }: { text: string }) => <span>{text}</span>,
}));

const stageRunning = { index: 0, name: 'Running step', status: null };
const stageCompleted = {
  index: 1,
  name: 'Completed step',
  status: StageStatus.Completed,
};
const stageFailed = {
  index: 2,
  name: 'Failed step',
  status: StageStatus.Failed,
};
const stageWithContent = {
  index: 3,
  name: 'Content step',
  status: StageStatus.Completed,
  content: 'Detailed stage output',
};
const stageRunningSecond = { index: 4, name: 'Running step 2', status: null };

describe('StagesPanel', () => {
  it('renders all stage rows', () => {
    render(
      <StagesPanel
        stages={[stageRunning, stageCompleted, stageFailed]}
        isStreaming={false}
      />,
    );

    expect(screen.getByRole('list')).not.toBeNull();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(screen.getByText('Running step')).not.toBeNull();
    expect(screen.getByText('Completed step')).not.toBeNull();
    expect(screen.getByText('Failed step')).not.toBeNull();
  });

  it('applies custom className and CSS variable colors', () => {
    const { container } = render(
      <StagesPanel
        stages={[stageRunning]}
        isStreaming={false}
        className="custom-panel"
        styles={{
          colors: {
            background: '#111111',
            border: '#222222',
            text: '#333333',
            stageTextColor: '#444444',
            runningColor: '#555555',
            completedColor: '#666666',
            failedColor: '#777777',
          },
        }}
      />,
    );

    const panel = container.firstElementChild as HTMLElement;

    expect(panel.className).toContain('custom-panel');
    expect(panel.style.getPropertyValue('--cs-bg')).toBe('#111111');
    expect(panel.style.getPropertyValue('--cs-border')).toBe('#222222');
    expect(panel.style.getPropertyValue('--cs-text')).toBe('#333333');
    expect(panel.style.getPropertyValue('--cs-stage-text')).toBe('#444444');
    expect(panel.style.getPropertyValue('--cs-running')).toBe('#555555');
    expect(panel.style.getPropertyValue('--cs-completed')).toBe('#666666');
    expect(panel.style.getPropertyValue('--cs-failed')).toBe('#777777');
  });

  it('applies typography.fontClassName to each stage row', () => {
    render(
      <StagesPanel
        stages={[stageRunning, stageCompleted]}
        isStreaming={false}
        styles={{ typography: { fontClassName: 'dial-body-text' } }}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].className).toContain('dial-body-text');
    expect(items[1].className).toContain('dial-body-text');
  });

  it('renders stage with content as collapsible row and toggles content by click', () => {
    render(<StagesPanel stages={[stageWithContent]} isStreaming={false} />);

    expect(screen.getByRole('button')).not.toBeNull();
    expect(screen.getByText('Detailed stage output')).not.toBeNull();

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Detailed stage output')).not.toBeNull();
  });

  it('renders stage without content as plain row (without toggle button)', () => {
    render(<StagesPanel stages={[stageRunning]} isStreaming={false} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Running step')).not.toBeNull();
  });

  it('does not show spinner for null-status stages when not streaming', () => {
    render(
      <StagesPanel
        stages={[stageRunning, stageRunningSecond]}
        isStreaming={false}
      />,
    );

    expect(screen.queryByRole('status', { name: 'Stage loading' })).toBeNull();
  });

  it('shows spinner only for the last null-status stage when streaming', () => {
    render(
      <StagesPanel
        stages={[stageRunning, stageCompleted, stageRunningSecond]}
        isStreaming
      />,
    );

    expect(
      screen.getAllByRole('status', { name: 'Stage loading' }),
    ).toHaveLength(1);
  });
});

import { StageStatus } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StagesPanel } from '../StagesPanel';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 14, MD: 16 },
  DialSpinner: ({ ariaLabel }: { ariaLabel?: string }) => (
    <span role="status" aria-label={ariaLabel} />
  ),
  DialEllipsisTooltip: ({ text }: { text: string }) => <>{text}</>,
}));

vi.mock('@epam/ai-dial-attachment-input', () => ({
  AttachmentCard: ({ attachment }: { attachment: { name: string } }) => (
    <div>{attachment.name}</div>
  ),
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

    expect(screen.getByRole('list')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Running step')).toBeTruthy();
    expect(screen.getByText('Completed step')).toBeTruthy();
    expect(screen.getByText('Failed step')).toBeTruthy();
  });

  it('applies custom className and the new row-level CSS variable colors', () => {
    const { container } = render(
      <StagesPanel
        stages={[stageRunning]}
        isStreaming={false}
        className="custom-panel"
        styles={{
          colors: {
            text: '#333333',
            rowHoverColor: '#222222',
            stageTextColor: '#444444',
            failedColor: '#777777',
          },
        }}
      />,
    );

    const panel = container.firstElementChild as HTMLElement;

    expect(panel.className).toContain('custom-panel');
    expect(panel.style.getPropertyValue('--cs-text')).toBe('#333333');
    expect(panel.style.getPropertyValue('--cs-row-hover')).toBe('#222222');
    expect(panel.style.getPropertyValue('--cs-stage-text')).toBe('#444444');
    expect(panel.style.getPropertyValue('--cs-failed-text')).toBe('#777777');
  });

  it('applies typography.fontClassName to each stage row name', () => {
    render(
      <StagesPanel
        stages={[stageRunning, stageCompleted]}
        isStreaming={false}
        styles={{ typography: { fontClassName: 'dial-body-text' } }}
      />,
    );

    expect(
      screen.getByText('Running step').closest('span')?.className,
    ).toContain('dial-body-text');
    expect(
      screen.getByText('Completed step').closest('span')?.className,
    ).toContain('dial-body-text');
  });

  it('defaults the row name to dial-small-text and expanded content to dial-tiny-text', () => {
    render(
      <StagesPanel
        stages={[
          { ...stageCompleted, name: 'Completed step', content: 'Detail text' },
        ]}
        isStreaming={false}
      />,
    );

    expect(
      screen.getByText('Completed step').closest('span')?.className,
    ).toContain('dial-small-text');

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Detail text').closest('p')?.className).toContain(
      'dial-tiny-text',
    );
  });

  it('defaults every heading level in expanded content to dial-small-semi-text (14px, semibold)', () => {
    render(
      <StagesPanel
        stages={[
          {
            ...stageCompleted,
            name: 'Completed step',
            content: '# Big heading\n\n## Smaller heading',
          },
        ]}
        isStreaming={false}
      />,
    );

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Big heading').className).toContain(
      'dial-small-semi-text',
    );
    expect(screen.getByText('Smaller heading').className).toContain(
      'dial-small-semi-text',
    );
  });

  it('applies typography.headingClassName to every heading level in expanded content', () => {
    render(
      <StagesPanel
        stages={[
          {
            ...stageCompleted,
            name: 'Completed step',
            content: '# Big heading',
          },
        ]}
        isStreaming={false}
        styles={{ typography: { headingClassName: 'dial-h1-text' } }}
      />,
    );

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Big heading').className).toContain('dial-h1-text');
  });

  it('renders a stage with content as a disclosure button that toggles the content', () => {
    render(<StagesPanel stages={[stageWithContent]} isStreaming={false} />);

    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText('Detailed stage output')).toBeTruthy();

    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('renders a stage without expandable content as a plain row (no button)', () => {
    render(<StagesPanel stages={[stageRunning]} isStreaming={false} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Running step')).toBeTruthy();
  });

  it('does not show a running spinner for null-status stages when not streaming', () => {
    render(
      <StagesPanel
        stages={[stageRunning, stageRunningSecond]}
        isStreaming={false}
      />,
    );

    expect(screen.queryByRole('status', { name: 'Running' })).toBeNull();
  });

  it('shows the running spinner only for the last null-status stage when streaming', () => {
    render(
      <StagesPanel
        stages={[stageRunning, stageCompleted, stageRunningSecond]}
        isStreaming
      />,
    );

    expect(screen.getAllByRole('status', { name: 'Running' })).toHaveLength(1);
  });

  it('collapses repeated identical names into one ×N row that expands to the individual attempts', () => {
    render(
      <StagesPanel
        stages={[
          {
            index: 0,
            name: 'Search weather forecast',
            status: StageStatus.Completed,
          },
          {
            index: 1,
            name: 'Search weather forecast',
            status: StageStatus.Completed,
          },
          {
            index: 2,
            name: 'Search weather forecast',
            status: StageStatus.Completed,
          },
        ]}
        isStreaming={false}
      />,
    );

    const toggle = screen.getByRole('button');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText('×3')).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Attempt 1')).toBeTruthy();
    expect(screen.getByText('Attempt 2')).toBeTruthy();
    expect(screen.getByText('Attempt 3')).toBeTruthy();
  });

  it('renders an attachment inside an expanded stage via the shared AttachmentCard', () => {
    render(
      <StagesPanel
        stages={[
          {
            index: 0,
            name: 'Generated report',
            status: StageStatus.Completed,
            attachments: [{ title: 'summary.pdf' }],
          },
        ]}
        isStreaming={false}
      />,
    );

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('summary.pdf')).toBeTruthy();
  });
});

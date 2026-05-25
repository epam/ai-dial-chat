import { StageStatus } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StagesPanel } from './StagesPanel.js';

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

describe('StagesPanel', () => {
  it('renders all stage rows when open', () => {
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

  it('running stage (status null) renders IconLoader2 with animate-spin', () => {
    const { container } = render(
      <StagesPanel stages={[stageRunning]} isStreaming />,
    );

    const spinningIcon = container.querySelector('.animate-spin');
    expect(spinningIcon).not.toBeNull();
  });

  it('completed stage renders no spinner', () => {
    const { container } = render(
      <StagesPanel stages={[stageCompleted]} isStreaming={false} />,
    );

    expect(container.querySelector('.animate-spin')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('failed stage renders no spinner', () => {
    const { container } = render(
      <StagesPanel stages={[stageFailed]} isStreaming={false} />,
    );

    expect(container.querySelector('.animate-spin')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('clicking the header toggles panel closed then open', () => {
    render(<StagesPanel stages={[stageRunning]} isStreaming={false} />);

    expect(screen.getByRole('list')).not.toBeNull();

    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByRole('list')).toBeNull();

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('list')).not.toBeNull();
  });

  it('pressing Enter on the header toggles the panel', () => {
    render(<StagesPanel stages={[stageRunning]} isStreaming={false} />);

    const header = screen.getByRole('button');

    fireEvent.keyDown(header, { key: 'Enter' });
    expect(screen.queryByRole('list')).toBeNull();

    fireEvent.keyDown(header, { key: 'Enter' });
    expect(screen.getByRole('list')).not.toBeNull();
  });

  it('pressing Space on the header toggles the panel', () => {
    render(<StagesPanel stages={[stageRunning]} isStreaming={false} />);

    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('renders no stage rows when defaultOpen is false', () => {
    render(
      <StagesPanel
        stages={[stageRunning, stageCompleted]}
        isStreaming={false}
        defaultOpen={false}
      />,
    );

    expect(screen.queryByRole('list')).toBeNull();
  });

  it('uses custom headerLabel when provided', () => {
    render(
      <StagesPanel
        stages={[stageRunning]}
        isStreaming={false}
        headerLabel="Agent steps"
      />,
    );

    expect(screen.getByText('Agent steps')).not.toBeNull();
  });
});

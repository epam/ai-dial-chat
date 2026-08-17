import { StageStatus } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StageIcon } from '../StageIcon';

describe('StageIcon — icon priority order', () => {
  it('shows the running spinner when isLive is true, regardless of status', () => {
    render(<StageIcon status={null} isLive />);
    expect(screen.getByLabelText('Running')).toBeTruthy();
  });

  it('prioritizes the running spinner over a settled status when both are somehow present', () => {
    render(<StageIcon status={StageStatus.Failed} isLive />);
    expect(screen.getByLabelText('Running')).toBeTruthy();
    expect(screen.queryByText('Failed')).toBeNull();
  });

  it('shows the failed (exception) icon with a visually-hidden label when not live and failed', () => {
    const { container } = render(
      <StageIcon status={StageStatus.Failed} isLive={false} />,
    );
    expect(screen.getByText('Failed')).toBeTruthy();
    /*
     * The status icon is intentionally aria-hidden and decorative (its
     * meaning is carried by the adjacent sr-only label above), so there is
     * no accessible role/name to query it by.
     */
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- see comment above
    expect(container.querySelector('svg[aria-hidden]')).toBeTruthy();
  });

  it('shows the quiet check icon for a completed stage', () => {
    const { container } = render(
      <StageIcon status={StageStatus.Completed} isLive={false} />,
    );
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- decorative aria-hidden icon, no accessible query applies
    expect(container.querySelector('svg[aria-hidden]')).toBeTruthy();
    expect(screen.queryByText('Failed')).toBeNull();
    expect(screen.queryByLabelText('Running')).toBeNull();
  });

  it('falls back to the quiet check icon for a settled-but-unresolved (null, not live) stage', () => {
    const { container } = render(<StageIcon status={null} isLive={false} />);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- decorative aria-hidden icon, no accessible query applies
    expect(container.querySelector('svg[aria-hidden]')).toBeTruthy();
    expect(screen.queryByText('Failed')).toBeNull();
  });

  it('supports custom running and failed labels', () => {
    const { rerender } = render(
      <StageIcon status={null} isLive runningLabel="Executing" />,
    );
    expect(screen.getByLabelText('Executing')).toBeTruthy();

    rerender(
      <StageIcon
        status={StageStatus.Failed}
        isLive={false}
        failedLabel="Errored"
      />,
    );
    expect(screen.getByText('Errored')).toBeTruthy();
  });
});

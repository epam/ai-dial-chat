import { StageStatus } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CollapsedGroup } from '../CollapsedGroup';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 14, MD: 16 },
  Spinner: ({ ariaLabel }: { ariaLabel?: string }) => (
    <span role="status" aria-label={ariaLabel} />
  ),
  DialEllipsisTooltip: ({ text }: { text: string }) => <>{text}</>,
  LinkButton: ({
    label,
    onClick,
    className,
    'aria-expanded': ariaExpanded,
  }: {
    label: ReactNode;
    onClick?: () => void;
    className?: string;
    'aria-expanded'?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={className}
      aria-expanded={ariaExpanded}
    >
      {label}
    </button>
  ),
}));

vi.mock('@epam/ai-dial-attachment-input', () => ({
  AttachmentCard: ({ attachment }: { attachment: { name: string } }) => (
    <div>{attachment.name}</div>
  ),
}));

const completed = (index: number, name: string) => ({
  index,
  name,
  status: StageStatus.Completed,
});
const failed = (index: number, name: string) => ({
  index,
  name,
  status: StageStatus.Failed,
});
const running = (index: number, name: string) => ({
  index,
  name,
  status: null,
});

describe('CollapsedGroup — collapsed states', () => {
  it('renders nothing for an empty stage list', () => {
    const { container } = render(
      <CollapsedGroup stages={[]} isStreaming={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a single stage directly, with no summary wrapper', () => {
    render(
      <CollapsedGroup
        stages={[completed(0, 'Parsed intent')]}
        isStreaming={false}
      />,
    );
    expect(screen.getByText('Parsed intent')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Executed/ })).toBeNull();
  });

  it('collapses to a finished summary line by default once the run finishes', () => {
    render(
      <CollapsedGroup
        stages={[completed(0, 'Step 1'), completed(1, 'Step 2')]}
        isStreaming={false}
      />,
    );
    const toggle = screen.getByRole('button');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText(/Executed 2 steps/)).toBeTruthy();
  });

  it('collapses to a failed summary with the failed count called out', () => {
    render(
      <CollapsedGroup
        stages={[completed(0, 'Step 1'), failed(1, 'Step 2')]}
        isStreaming={false}
      />,
    );
    expect(screen.getByText(/1 failed/)).toBeTruthy();
  });

  it('is expanded by default while running, showing progress through the live step', () => {
    render(
      <CollapsedGroup
        stages={[completed(0, 'Step 1'), running(1, 'Step 2')]}
        isStreaming
      />,
    );
    const toggle = screen.getByRole('button');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/Step 2 of 2/)).toBeTruthy();
  });

  it('announces the running summary via a polite live region', () => {
    const { container } = render(
      <CollapsedGroup
        stages={[completed(0, 'Step 1'), running(1, 'Step 2')]}
        isStreaming
      />,
    );
    expect(container.querySelector('[aria-live="polite"]')).toBeTruthy();
  });
});

describe('CollapsedGroup — collapse-by-default-when-finished transition', () => {
  it('auto-collapses the moment a running group finishes', () => {
    const { rerender } = render(
      <CollapsedGroup
        stages={[completed(0, 'Step 1'), running(1, 'Step 2')]}
        isStreaming
      />,
    );
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe(
      'true',
    );

    rerender(
      <CollapsedGroup
        stages={[completed(0, 'Step 1'), completed(1, 'Step 2')]}
        isStreaming={false}
      />,
    );
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe(
      'false',
    );
  });
});

describe('CollapsedGroup — labels', () => {
  it('uses the supplied executedLabel/stepsLabel for the finished summary', () => {
    render(
      <CollapsedGroup
        stages={[completed(0, 'Step 1'), completed(1, 'Step 2')]}
        isStreaming={false}
        labels={{
          executedLabel: 'Ran',
          stepsLabel: (n) => (n === 1 ? 'stage' : 'stages'),
        }}
      />,
    );
    expect(screen.getByText(/Ran 2 stages/)).toBeTruthy();
  });
});

import { StageStatus } from '@epam/ai-dial-chat-shared';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CONVERSATION_STAGES_CLASS } from '../../../constants/public-class-names';
import { CollapsedGroup } from '../CollapsedGroup';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 14, MD: 16 },
  Spinner: ({ ariaLabel }: { ariaLabel?: string }) => (
    <span role="status" aria-label={ariaLabel} />
  ),
  EllipsisTooltip: ({ text }: { text: string }) => <>{text}</>,
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
    expect(container.innerHTML).toBe('');
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

  it('shows elapsed time without double-counting parallel stages', () => {
    render(
      <CollapsedGroup
        stages={[
          completed(0, 'Tool A (40s, Start: 11:21:00, End: 11:21:40)'),
          completed(1, 'Tool B (40s, Start: 11:21:00, End: 11:21:40)'),
          completed(2, 'Tool C (40s, Start: 11:21:00, End: 11:21:40)'),
        ]}
        isStreaming={false}
      />,
    );

    expect(screen.getByText('40.0s')).toBeTruthy();
    expect(screen.queryByText('2m 0s')).toBeNull();
  });

  it('is expanded by default while running, showing the live step name', () => {
    render(
      <CollapsedGroup
        stages={[completed(0, 'Step 1'), running(1, 'Step 2')]}
        isStreaming
      />,
    );
    const toggle = screen.getByRole('button');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(within(toggle).getByText('Step 2')).toBeTruthy();
  });

  it('shows no step counter while running', () => {
    render(
      <CollapsedGroup
        stages={[
          completed(0, 'Search'),
          completed(1, 'Read'),
          running(2, 'Summarize'),
        ]}
        isStreaming
      />,
    );
    expect(
      within(screen.getByRole('button')).queryByText(/\d+ of \d+/),
    ).toBeNull();
  });

  it('keeps the last stage name while streaming with every stage settled', () => {
    render(
      <CollapsedGroup
        stages={[completed(0, 'Search'), completed(1, 'Summarize')]}
        isStreaming
      />,
    );
    expect(
      within(screen.getByRole('button')).getByText('Summarize'),
    ).toBeTruthy();
  });

  it('keeps a long live stage name on one truncated line', () => {
    const longName =
      "Processing document 'uploads/2026-08/NAUP-How to login to high environments-220726-103753 1.pdf'";
    render(
      <CollapsedGroup
        stages={[completed(0, 'Step 1'), running(1, longName)]}
        isStreaming
      />,
    );
    /* The same name also renders in the expanded StagesPanel row, so scope the
       query to the summary line inside the toggle button. */
    const liveName = within(screen.getByRole('button')).getByText(longName);
    expect(liveName.className).toContain('truncate');
  });

  it('announces the running summary via a polite live region', () => {
    render(
      <CollapsedGroup
        stages={[completed(0, 'Step 1'), running(1, 'Step 2')]}
        isStreaming
      />,
    );
    // role="status" implies aria-live="polite"; the Spinner mock also
    // renders one, so confirm the summary text is inside a status region.
    const summaryText = within(screen.getByRole('button')).getByText('Step 2');
    const isAnnounced = screen
      .getAllByRole('status')
      .some((status) => status.contains(summaryText));
    expect(isAnnounced).toBe(true);
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

/*
 * Walking up to an unlabeled container is the only way to assert a class on it:
 * the element has no role or text of its own, and querying *by* the class would
 * still pass with the class on the wrong node.
 */
const closestWithClass = (from: Element, className: string): Element | null =>
  // eslint-disable-next-line testing-library/no-node-access -- see above
  from.closest(`.${className}`);

describe('conversation-stages — public class names', () => {
  /*
   * A lost public class fails silently: the build passes and a host's
   * stylesheet simply stops applying, so each class is asserted here. The
   * panel root carries no role, so the stage row is located by text first.
   */
  it('stamps the panel root behind a collapsed group', () => {
    render(
      <CollapsedGroup
        stages={[completed(0, 'Step 1'), completed(1, 'Step 2')]}
        isStreaming={false}
      />,
    );

    expect(
      closestWithClass(
        screen.getByText('Step 1'),
        CONVERSATION_STAGES_CLASS.panel,
      ),
    ).toBeTruthy();
  });

  it('stamps the group root and its summary toggle', () => {
    render(
      <CollapsedGroup
        stages={[completed(0, 'Step 1'), completed(1, 'Step 2')]}
        isStreaming={false}
      />,
    );

    const toggle = screen.getAllByRole('button')[0];
    expect(toggle.classList).toContain(CONVERSATION_STAGES_CLASS.groupToggle);
    expect(
      closestWithClass(toggle, CONVERSATION_STAGES_CLASS.group),
    ).toBeTruthy();
  });
});

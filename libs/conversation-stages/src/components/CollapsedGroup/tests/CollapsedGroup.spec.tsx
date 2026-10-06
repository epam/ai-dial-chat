import { StageStatus } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CONVERSATION_STAGES_CLASS } from '../../../constants/public-class-names';
import { CollapsedGroup } from '../CollapsedGroup';

/* Disclosures are the real kit `Accordion`, so their button, region and inert state are what a user gets. */
vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const { Accordion } =
    await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    Accordion,
    DIAL_KIT_ICON_STROKE: 1.5,
    DIAL_ICON_SIZE: { SM: 14, MD: 16 },
    Spinner: ({ ariaLabel }: { ariaLabel?: string }) => (
      <span role="status" aria-label={ariaLabel} />
    ),
    EllipsisTooltip: ({ text }: { text: string }) => <>{text}</>,
  };
});

vi.mock('@epam/ai-dial-attachment-input', () => ({
  AttachmentCard: ({
    attachment,
    onClick,
  }: {
    attachment: { id: string; name: string };
    onClick?: (id: string) => void;
  }) => (
    <button type="button" onClick={() => onClick?.(attachment.id)}>
      {attachment.name}
    </button>
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
  it('mounts the panel on demand and resets nested disclosures when closed', () => {
    render(
      <CollapsedGroup
        stages={[
          { ...completed(0, 'Step 1'), content: 'Stage details' },
          completed(1, 'Step 2'),
        ]}
        isStreaming={false}
      />,
    );
    const toggle = screen.getByRole('button', { name: /Executed 2 steps/ });
    expect(screen.queryByText('Step 1')).toBeNull();
    expect(screen.queryByText('Stage details')).toBeNull();

    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: /Step 1/ }));
    expect(screen.getByText('Stage details')).toBeTruthy();

    fireEvent.click(toggle);
    expect(screen.queryByText('Stage details')).toBeNull();
    expect(screen.queryByText('Step 1')).toBeNull();

    fireEvent.click(toggle);
    expect(
      screen
        .getByRole('button', { name: /Step 1/ })
        .getAttribute('aria-expanded'),
    ).toBe('false');
    expect(screen.queryByText('Stage details')).toBeNull();
  });

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

  it('omits a total execution time from the finished summary', () => {
    render(
      <CollapsedGroup
        stages={[
          completed(0, 'Tool A (40s, Start: 11:21:00, End: 11:21:40)'),
          completed(1, 'Tool B [40s]'),
        ]}
        isStreaming={false}
      />,
    );

    expect(
      screen.getByRole('button', { name: /Executed/ }).textContent,
    ).not.toMatch(/\d+(\.\d+)?s\b|\dm \d+s/);
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
    expect(screen.getByText('Step 1')).toBeTruthy();

    rerender(
      <CollapsedGroup
        stages={[completed(0, 'Step 1'), completed(1, 'Step 2')]}
        isStreaming={false}
      />,
    );
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe(
      'false',
    );
    expect(screen.queryByText('Step 1')).toBeNull();
  });
});

describe('CollapsedGroup — onAttachmentClick', () => {
  const attachmentStage = {
    index: 0,
    name: 'Combined search',
    status: StageStatus.Completed,
    attachments: [
      { title: 'result.csv', reference_url: 'files/abc/result.csv' },
    ],
  };

  it('forwards onAttachmentClick to the inner panel for a single stage', () => {
    const onAttachmentClick = vi.fn();
    render(
      <CollapsedGroup
        stages={[attachmentStage]}
        isStreaming={false}
        onAttachmentClick={onAttachmentClick}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Combined search/ }));
    fireEvent.click(screen.getByRole('button', { name: 'result.csv' }));
    expect(onAttachmentClick).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'result.csv' }),
    );
  });

  it('forwards onAttachmentClick to the inner panel for a multi-stage group', () => {
    const onAttachmentClick = vi.fn();
    render(
      <CollapsedGroup
        stages={[attachmentStage, completed(1, 'Step 2')]}
        isStreaming={false}
        onAttachmentClick={onAttachmentClick}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Executed 2 steps/ }));
    fireEvent.click(screen.getByRole('button', { name: /Combined search/ }));
    fireEvent.click(screen.getByRole('button', { name: 'result.csv' }));
    expect(onAttachmentClick).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'result.csv' }),
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
  it('stamps the panel root when a collapsed group is opened', () => {
    render(
      <CollapsedGroup
        stages={[completed(0, 'Step 1'), completed(1, 'Step 2')]}
        isStreaming={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Executed 2 steps/ }));

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

    const toggle = screen.getByRole('button', { name: /Executed 2 steps/ });
    expect(toggle.classList).toContain(CONVERSATION_STAGES_CLASS.groupToggle);
    expect(
      closestWithClass(toggle, CONVERSATION_STAGES_CLASS.group),
    ).toBeTruthy();
  });
});

describe('CollapsedGroup — nested stages', () => {
  const child = (
    stage: ReturnType<typeof completed> | ReturnType<typeof failed>,
    parent: number,
  ) => ({ ...stage, parent_stage_index: parent });

  it('counts every stage once, including a failed child, whatever the disclosure state', () => {
    render(
      <CollapsedGroup
        stages={[
          completed(0, 'Plan'),
          child(completed(1, 'Search'), 0),
          child(failed(2, 'Read'), 0),
        ]}
        isStreaming={false}
      />,
    );

    expect(screen.getByText(/Executed 3 steps/)).toBeTruthy();
    expect(screen.getByText('1 failed')).toBeTruthy();
  });

  it('keeps a stage expanded when a second stage switches the group layout', async () => {
    const user = userEvent.setup();
    const first = { ...running(0, 'Plan'), content: 'thinking' };
    const { rerender } = render(
      <CollapsedGroup stages={[first]} isStreaming />,
    );

    await user.click(screen.getByRole('button', { name: /Plan/ }));
    rerender(
      <CollapsedGroup
        stages={[first, { ...running(1, 'Search'), parent_stage_index: 0 }]}
        isStreaming
      />,
    );

    /* The last "Plan" disclosure is the stage row; the first is the live summary. */
    const plan = screen.getAllByRole('button', { name: /Plan/ }).at(-1)!;
    expect(plan.getAttribute('aria-controls')).toBeTruthy();
    expect(screen.getByText('thinking')).toBeTruthy();
    expect(plan.getAttribute('aria-expanded')).toBe('true');
  });
});

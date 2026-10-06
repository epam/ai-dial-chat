import { StageStatus } from '@epam/ai-dial-chat-shared';
import type { Stage } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StagesPanel } from '../StagesPanel';

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

    /*
     * The outermost panel div carries the CSS custom properties and custom
     * className but has no ARIA role of its own — a CSS-level check with no
     * semantic query available.
     */
    // eslint-disable-next-line testing-library/no-node-access -- see comment above
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

    expect(screen.getByText('Running step').className).toContain(
      'dial-body-text',
    );
    expect(screen.getByText('Completed step').className).toContain(
      'dial-body-text',
    );
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

    expect(screen.getByText('Completed step').className).toContain(
      'dial-small-text',
    );

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Detail text').className).toContain(
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
    expect(screen.queryByText('Detailed stage output')).toBeNull();

    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Detailed stage output')).toBeTruthy();

    fireEvent.click(button);
    expect(screen.queryByText('Detailed stage output')).toBeNull();
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

  it('keeps every null-status stage running until its completed status arrives', () => {
    const { rerender } = render(
      <StagesPanel
        stages={[stageRunning, stageCompleted, stageRunningSecond]}
        isStreaming
      />,
    );

    expect(screen.getAllByRole('status', { name: 'Running' })).toHaveLength(2);

    rerender(
      <StagesPanel
        stages={[
          { ...stageRunning, status: StageStatus.Completed },
          stageCompleted,
          stageRunningSecond,
        ]}
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
    expect(screen.queryByText('Attempt 1')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Attempt 1')).toBeTruthy();
    expect(screen.getByText('Attempt 2')).toBeTruthy();
    expect(screen.getByText('Attempt 3')).toBeTruthy();

    fireEvent.click(toggle);
    expect(screen.queryByText('Attempt 1')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByText('Attempt 1')).toBeTruthy();
  });

  it('keeps a repeated-stage group running while any attempt is unresolved', () => {
    const completedAttempt = {
      index: 0,
      name: 'Search weather forecast',
      status: StageStatus.Completed,
    };
    const runningAttempt = {
      index: 1,
      name: 'Search weather forecast',
      status: null,
    };
    const { rerender } = render(
      <StagesPanel stages={[completedAttempt, runningAttempt]} isStreaming />,
    );

    expect(
      within(screen.getByRole('button')).getByRole('status', {
        name: 'Running',
      }),
    ).toBeTruthy();

    rerender(
      <StagesPanel
        stages={[
          completedAttempt,
          { ...runningAttempt, status: StageStatus.Completed },
        ]}
        isStreaming
      />,
    );

    expect(
      within(screen.getByRole('button')).queryByRole('status', {
        name: 'Running',
      }),
    ).toBeNull();
  });

  it('shows no total time on a collapsed stage row', () => {
    render(
      <StagesPanel
        stages={[
          {
            index: 0,
            name: 'Search (40s, Start: 11:21:00, End: 11:21:40)',
            status: StageStatus.Completed,
          },
          {
            index: 1,
            name: 'Search (40s, Start: 11:21:00, End: 11:21:40)',
            status: StageStatus.Completed,
          },
        ]}
        isStreaming={false}
      />,
    );

    expect(screen.getByText('×2')).toBeTruthy();
    expect(screen.queryByText('40.0s')).toBeNull();
    expect(screen.queryByText('1m 20s')).toBeNull();
  });

  it('passes onAttachmentClick through to a rendered stage attachment tile', () => {
    const onAttachmentClick = vi.fn();
    const stageWithAttachment = {
      index: 5,
      name: 'Combined search',
      status: StageStatus.Completed,
      attachments: [
        { title: 'result.csv', reference_url: 'files/abc/result.csv' },
      ],
    };
    render(
      <StagesPanel
        stages={[stageWithAttachment]}
        isStreaming={false}
        onAttachmentClick={onAttachmentClick}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Combined search/ }));
    fireEvent.click(screen.getByRole('button', { name: 'result.csv' }));
    expect(onAttachmentClick).toHaveBeenCalledOnce();
    expect(onAttachmentClick).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'result.csv' }),
    );
  });
});

const nested = (
  index: number,
  name: string,
  parent?: number,
  extra: Partial<Stage> = {},
): Stage => ({
  index,
  name,
  status: StageStatus.Completed,
  ...(parent !== undefined && { parent_stage_index: parent }),
  ...extra,
});

const disclosure = (name: RegExp) => screen.getByRole('button', { name });

/*
 * The kit marks a collapsed region's wrapper `inert`, which removes it from
 * the tab order and the accessibility tree in browsers; jsdom queries do not
 * apply `inert`, so reachability is asserted on the attribute itself.
 */
const isInert = (element: HTMLElement): boolean =>
  // eslint-disable-next-line testing-library/no-node-access -- see comment above
  element.closest('[inert]') != null;

const regionOf = (button: HTMLElement): HTMLElement => {
  const region = screen
    .getAllByRole('region')
    .find((candidate) => candidate.id === button.getAttribute('aria-controls'));
  if (!region) throw new Error('disclosure has no controlled region');
  return region;
};

describe('StagesPanel — nested stages', () => {
  it('renders multiple roots with three levels inside their ancestors', async () => {
    const user = userEvent.setup();
    render(
      <StagesPanel
        stages={[
          nested(0, 'Plan'),
          nested(1, 'Search', 0),
          nested(2, 'Read', 1, { content: 'Read output' }),
          nested(3, 'Summarize'),
        ]}
        isStreaming={false}
      />,
    );

    expect(screen.queryByRole('button', { name: /Search/ })).toBeNull();

    await user.click(disclosure(/Plan/));
    expect(isInert(disclosure(/Search/))).toBe(false);
    expect(regionOf(disclosure(/Plan/)).textContent).toContain('Search');
    await user.click(disclosure(/Search/));
    expect(regionOf(disclosure(/Search/)).textContent).toContain('Read');
    expect(screen.queryByText('Read output')).toBeNull();
    expect(
      within(regionOf(disclosure(/Plan/))).queryByText('Summarize'),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: /Summarize/ })).toBeNull();
  });

  it('makes a parent with only children an expandable disclosure', async () => {
    const user = userEvent.setup();
    render(
      <StagesPanel
        stages={[nested(0, 'Plan'), nested(1, 'Search', 0)]}
        isStreaming={false}
      />,
    );

    const plan = disclosure(/Plan/);
    expect(plan.getAttribute('aria-expanded')).toBe('false');
    expect(isInert(regionOf(plan))).toBe(true);

    await user.click(plan);

    expect(plan.getAttribute('aria-expanded')).toBe('true');
    expect(isInert(regionOf(plan))).toBe(false);
  });

  it('keeps a completed parent completed while its child is still running', async () => {
    const user = userEvent.setup();
    render(
      <StagesPanel
        stages={[nested(0, 'Plan'), nested(1, 'Search', 0, { status: null })]}
        isStreaming
      />,
    );

    const plan = disclosure(/Plan/);
    expect(within(plan).queryByRole('status')).toBeNull();

    await user.click(plan);

    expect(
      within(regionOf(plan)).getByRole('status', { name: 'Running' }),
    ).toBeTruthy();
  });

  it('keeps an expanded stage open through content, sibling, name and status updates', async () => {
    const user = userEvent.setup();
    const initial = [
      nested(0, 'Plan', undefined, { status: null }),
      nested(1, 'Search', 0, { status: null }),
    ];
    const { rerender } = render(<StagesPanel stages={initial} isStreaming />);

    await user.click(disclosure(/Plan/));
    rerender(
      <StagesPanel
        stages={[
          nested(0, 'Plan more', undefined, { content: 'notes' }),
          nested(1, 'Search', 0, { status: null, content: 'grown' }),
          nested(2, 'Read', 0, { status: null }),
          nested(3, 'Answer'),
        ]}
        isStreaming
      />,
    );

    expect(disclosure(/Plan more/).getAttribute('aria-expanded')).toBe('true');
    expect(regionOf(disclosure(/Plan more/)).textContent).toContain('Read');
  });

  it('restores a child expansion when its collapsed parent reopens', async () => {
    const user = userEvent.setup();
    render(
      <StagesPanel
        stages={[
          nested(0, 'Plan'),
          nested(1, 'Search', 0, { content: 'Search output' }),
        ]}
        isStreaming={false}
      />,
    );

    await user.click(disclosure(/Plan/));
    await user.click(disclosure(/Search/));
    await user.click(disclosure(/Plan/));
    expect(screen.queryByText('Search output')).toBeNull();

    await user.click(disclosure(/Plan/));

    expect(disclosure(/Search/).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Search output')).toBeTruthy();
  });

  it('keeps the first attempt expanded after a second attempt forms a retry group', async () => {
    const user = userEvent.setup();
    const first = nested(0, 'Search', undefined, { content: 'first output' });
    const { rerender } = render(
      <StagesPanel stages={[first]} isStreaming={false} />,
    );

    await user.click(disclosure(/Search/));
    rerender(
      <StagesPanel
        stages={[first, nested(1, 'Search', undefined, { content: 'second' })]}
        isStreaming={false}
      />,
    );

    const group = disclosure(/Search\s*×2/);
    expect(group.getAttribute('aria-expanded')).toBe('false');
    await user.click(group);
    expect(disclosure(/Attempt 1/).getAttribute('aria-expanded')).toBe('true');
    expect(disclosure(/Attempt 2/).getAttribute('aria-expanded')).toBe('false');
  });

  it('does not group equal child names under different parents', () => {
    render(
      <StagesPanel
        stages={[
          nested(0, 'Plan A'),
          nested(1, 'Search', 0),
          nested(2, 'Plan B'),
          nested(3, 'Search', 2),
        ]}
        isStreaming={false}
      />,
    );

    expect(screen.queryByText(/×/)).toBeNull();
  });

  it('groups sibling attempts under their parent and keeps the third sibling separate', async () => {
    const user = userEvent.setup();
    render(
      <StagesPanel
        stages={[
          nested(0, 'Plan'),
          nested(1, 'Search', 0),
          nested(2, 'Search', 0),
          nested(3, 'Read', 0),
        ]}
        isStreaming={false}
      />,
    );

    await user.click(disclosure(/Plan/));

    const region = regionOf(disclosure(/Plan/));
    expect(
      within(region).getByRole('button', { name: /Search\s*×2/ }),
    ).toBeTruthy();
    expect(within(region).getByText('Read')).toBeTruthy();
  });

  it('reveals only its own subtree from each grouped parent attempt', async () => {
    const user = userEvent.setup();
    render(
      <StagesPanel
        stages={[
          nested(0, 'Plan'),
          nested(1, 'Search one', 0),
          nested(2, 'Plan'),
          nested(3, 'Search two', 2),
        ]}
        isStreaming={false}
      />,
    );

    await user.click(disclosure(/Plan\s*×2/));
    await user.click(disclosure(/Attempt 1/));

    const firstAttempt = regionOf(disclosure(/Attempt 1/));
    expect(within(firstAttempt).getByText('Search one')).toBeTruthy();
    expect(within(firstAttempt).queryByText('Search two')).toBeNull();
  });

  it('renders a flat payload as one list without nested disclosures', () => {
    render(
      <StagesPanel
        stages={[nested(0, 'Plan'), nested(1, 'Search')]}
        isStreaming={false}
      />,
    );

    expect(screen.getAllByRole('list')).toHaveLength(1);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders a stage with an unknown parent at the root with its content reachable', async () => {
    const user = userEvent.setup();
    render(
      <StagesPanel
        stages={[
          nested(0, 'Plan'),
          nested(3, 'Orphan', 1, { content: 'kept' }),
        ]}
        isStreaming={false}
      />,
    );

    await user.click(disclosure(/Orphan/));
    expect(regionOf(disclosure(/Orphan/)).textContent).toContain('kept');
  });

  it('invokes the host attachment callback once from a grandchild with host labels', async () => {
    const user = userEvent.setup();
    const onAttachmentClick = vi.fn();
    render(
      <StagesPanel
        stages={[
          nested(0, 'Plan'),
          nested(1, 'Search', 0),
          nested(2, 'Search', 0),
          nested(3, 'Read', 1, {
            status: null,
            attachments: [{ title: 'doc.pdf', url: 'files/doc.pdf' }],
          }),
        ]}
        isStreaming
        labels={{
          attemptLabel: (n) => `Try ${n}`,
          runningAriaLabel: 'In progress',
        }}
        onAttachmentClick={onAttachmentClick}
      />,
    );

    await user.click(disclosure(/Plan/));
    await user.click(disclosure(/Search\s*×2/));
    await user.click(disclosure(/Try 1/));
    const read = disclosure(/Read/);
    expect(
      within(read).getByRole('status', { name: 'In progress' }),
    ).toBeTruthy();
    await user.click(read);
    await user.click(screen.getByRole('button', { name: 'doc.pdf' }));

    expect(onAttachmentClick).toHaveBeenCalledOnce();
    expect(onAttachmentClick).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'doc.pdf' }),
    );
  });

  it('toggles nested disclosures from the keyboard and hides collapsed descendants', async () => {
    const user = userEvent.setup();
    render(
      <StagesPanel
        stages={[
          nested(0, 'Plan'),
          nested(1, 'Search', 0, {
            attachments: [{ title: 'doc.pdf', url: 'files/doc.pdf' }],
          }),
        ]}
        isStreaming={false}
      />,
    );

    const plan = disclosure(/Plan/);
    plan.focus();
    await user.keyboard('{Enter}');
    expect(plan.getAttribute('aria-expanded')).toBe('true');

    await user.tab();
    const search = disclosure(/Search/);
    /* eslint-disable-next-line testing-library/no-node-access -- focus is the assertion; no semantic query exposes the active element */
    expect(document.activeElement).toBe(search);
    await user.keyboard(' ');
    expect(search.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'doc.pdf' })).toBeTruthy();

    plan.focus();
    await user.keyboard(' ');

    /* eslint-disable-next-line testing-library/no-node-access -- focus is the assertion; no semantic query exposes the active element */
    expect(document.activeElement).toBe(plan);
    expect(plan.getAttribute('aria-expanded')).toBe('false');
    expect(isInert(regionOf(plan))).toBe(true);
    /* Collapsed bodies unmount, so no hidden descendant can take focus. */
    expect(screen.queryByRole('button', { name: /Search/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'doc.pdf' })).toBeNull();
  });
});

describe('StagesPanel — RTL and deep nesting', () => {
  const chain = (depth: number): Stage[] =>
    Array.from({ length: depth }, (_, index) =>
      nested(index, `Level ${index}`, index === 0 ? undefined : index - 1),
    );

  it('indents with logical properties, caps indentation after level three and keeps every level reachable', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div dir="rtl">
        <StagesPanel stages={chain(6)} isStreaming={false} />
      </div>,
    );

    for (let level = 0; level < 5; level += 1) {
      await user.click(disclosure(new RegExp(`Level ${level}`)));
    }

    expect(screen.getByText('Level 5')).toBeTruthy();
    expect(isInert(screen.getByText('Level 5'))).toBe(false);
    /* CSS-level assertion: jsdom performs no layout, so the classes are the contract. */
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const lists = Array.from(container.querySelectorAll('ul'));
    expect(lists).toHaveLength(6);
    expect(
      lists.map((list) => list.className.match(/\bps-\d+\b/)?.[0]),
    ).toEqual(['ps-5', 'ps-4', 'ps-4', 'ps-4', 'ps-0', 'ps-0']);
    expect(container.innerHTML).not.toMatch(
      /\b(?:pl|pr|ml|mr|left|right)-\d|\btext-(?:left|right)\b/,
    );
  });

  it('mirrors the collapsed disclosure caret in RTL and gives disclosures a mobile touch target', () => {
    render(
      <div dir="rtl">
        <StagesPanel stages={chain(2)} isStreaming={false} />
      </div>,
    );

    const header = disclosure(/Level 0/);
    expect(header.className).toContain('mobile:min-h-11');
    // eslint-disable-next-line testing-library/no-node-access -- the caret is decorative (aria-hidden)
    const caret = header.querySelector('svg.tabler-icon-chevron-right');
    expect(caret?.getAttribute('class')).toContain('rtl:rotate-180');
    // eslint-disable-next-line testing-library/no-node-access -- status glyphs are decorative too
    const status = header.querySelector('svg.tabler-icon-check');
    expect(status?.getAttribute('class')).not.toMatch(/\brtl:/);
  });
});

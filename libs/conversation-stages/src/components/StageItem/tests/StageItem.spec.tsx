import { StageStatus } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StageItem } from '../StageItem';

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

const baseStage = {
  index: 0,
  name: 'Parsed user intent',
  status: StageStatus.Completed,
};

describe('StageItem deferred content', () => {
  it('mounts details and attachments only while open and renders updated data on reopening', () => {
    const onAttachmentClick = vi.fn();
    const { rerender } = render(
      <StageItem
        stage={{
          ...baseStage,
          content: '[Original link](https://example.com)',
          attachments: [
            { title: 'Original attachment', data: 'Original data' },
          ],
        }}
        isLive={false}
        onAttachmentClick={onAttachmentClick}
      />,
    );
    const toggle = screen.getByRole('button', { name: /Parsed user intent/ });
    expect(screen.queryByText('Original link')).toBeNull();
    expect(screen.queryByText('Original attachment')).toBeNull();

    fireEvent.click(toggle);
    expect(screen.getByRole('link', { name: 'Original link' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Original attachment' }),
    ).toBeTruthy();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const controlledId = toggle.getAttribute('aria-controls');
    expect(controlledId).toBeTruthy();

    fireEvent.click(toggle);
    expect(screen.queryByText('Original link')).toBeNull();
    expect(screen.queryByText('Original attachment')).toBeNull();
    expect(screen.queryByRole('link', { hidden: true })).toBeNull();

    rerender(
      <StageItem
        stage={{
          ...baseStage,
          content: '[Updated link](https://example.com)',
          attachments: [{ title: 'Updated attachment', data: 'Updated data' }],
        }}
        isLive={false}
        onAttachmentClick={onAttachmentClick}
      />,
    );
    expect(screen.queryByText('Updated link')).toBeNull();
    expect(screen.queryByText('Updated attachment')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByRole('link', { name: 'Updated link' })).toBeTruthy();
    expect(screen.queryByText('Original attachment')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Updated attachment' }));
    expect(onAttachmentClick).toHaveBeenCalledOnce();
    expect(onAttachmentClick).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Updated attachment',
        data: 'Updated data',
      }),
    );
    expect(toggle.getAttribute('aria-controls')).toBe(controlledId);
  });
});

describe('StageItem — optional-field rendering', () => {
  it('renders only the icon and name when no other field has data (minimum row)', () => {
    render(<StageItem stage={baseStage} isLive={false} typography={{}} />);

    expect(screen.getByText('Parsed user intent')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders the tag only when the stage carries one', () => {
    const { rerender } = render(
      <StageItem stage={baseStage} isLive={false} typography={{}} />,
    );
    expect(screen.queryByText('MCP')).toBeNull();

    rerender(
      <StageItem
        stage={{ ...baseStage, tag: 'MCP' }}
        isLive={false}
        typography={{}}
      />,
    );
    expect(screen.getByText('MCP')).toBeTruthy();
  });

  it('renders the duration only when the name carries one', () => {
    render(
      <StageItem
        stage={{ ...baseStage, name: 'Read weather data file [3.99s]' }}
        isLive={false}
        typography={{}}
      />,
    );
    expect(screen.getByText('3.99s')).toBeTruthy();
    expect(screen.getByText('Read weather data file')).toBeTruthy();
  });

  it('renders only the status icon svg (no chevron) when the stage has no expandable content', () => {
    const { container } = render(
      <StageItem stage={baseStage} isLive={false} typography={{}} />,
    );
    /*
     * Both the status icon and the chevron are aria-hidden decorative svgs
     * with no accessible role, so counting them has no semantic query
     * alternative.
     */
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- see comment above
    expect(container.querySelectorAll('svg')).toHaveLength(1);
  });

  it('renders a second svg (the chevron) once the stage has expandable content', () => {
    const { container } = render(
      <StageItem
        stage={{ ...baseStage, content: 'Some detail' }}
        isLive={false}
        typography={{}}
      />,
    );
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- decorative aria-hidden icons, no accessible query applies
    expect(container.querySelectorAll('svg')).toHaveLength(2);
  });

  it('renders a chevron and becomes a disclosure button when content is present', () => {
    render(
      <StageItem
        stage={{ ...baseStage, content: 'Some detail' }}
        isLive={false}
        typography={{}}
      />,
    );
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('renders a disclosure button when the stage has only attachments (no content)', () => {
    render(
      <StageItem
        stage={{
          ...baseStage,
          attachments: [{ title: 'result.csv', data: 'Some markdown' }],
        }}
        isLive={false}
        typography={{}}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Parsed user intent' }),
    ).toBeTruthy();
  });

  it('renders no toggle when the stage has neither content nor attachments', () => {
    render(
      <StageItem
        stage={{ ...baseStage, attachments: [] }}
        isLive={false}
        typography={{}}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('StageItem — attachment rendering', () => {
  it('renders a tile for each attachment, in order', async () => {
    const user = userEvent.setup();
    render(
      <StageItem
        stage={{
          ...baseStage,
          attachments: [
            { index: 0, title: 'First', data: 'first body' },
            { index: 1, title: 'Second', data: 'second body' },
          ],
        }}
        isLive={false}
        typography={{}}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: /Parsed user intent/ }),
    );
    const tiles = screen.getAllByRole('button', { name: /First|Second/ });
    expect(tiles.map((el) => el.textContent)).toEqual(['First', 'Second']);
  });

  it('calls onAttachmentClick with the mapped display attachment when a tile is activated', async () => {
    const user = userEvent.setup();
    const onAttachmentClick = vi.fn();
    render(
      <StageItem
        stage={{
          ...baseStage,
          attachments: [{ title: 'result.csv', data: 'Some markdown text' }],
        }}
        isLive={false}
        typography={{}}
        onAttachmentClick={onAttachmentClick}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: /Parsed user intent/ }),
    );
    await user.click(screen.getByRole('button', { name: 'result.csv' }));
    expect(onAttachmentClick).toHaveBeenCalledOnce();
    expect(onAttachmentClick).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'result.csv',
        data: 'Some markdown text',
      }),
    );
  });

  it('renders a tile for a reference-only attachment (no inline data)', async () => {
    const user = userEvent.setup();
    render(
      <StageItem
        stage={{
          ...baseStage,
          attachments: [
            { title: 'result.csv', reference_url: 'files/abc/result.csv' },
          ],
        }}
        isLive={false}
        typography={{}}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: /Parsed user intent/ }),
    );
    expect(screen.getByRole('button', { name: 'result.csv' })).toBeTruthy();
  });

  it('renders the tile even when no onAttachmentClick handler is supplied', async () => {
    const user = userEvent.setup();
    render(
      <StageItem
        stage={{
          ...baseStage,
          attachments: [{ title: 'result.csv', data: 'Some markdown text' }],
        }}
        isLive={false}
        typography={{}}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: /Parsed user intent/ }),
    );
    expect(screen.getByText('result.csv')).toBeTruthy();
  });
});

describe('StageItem — name cleanup', () => {
  it('strips the trailing colon from a raw identifier and never forces a casing change', () => {
    render(
      <StageItem
        stage={{ ...baseStage, name: 'Call My_OMDB_Agent__0_0_1_tool:' }}
        isLive={false}
        typography={{}}
      />,
    );
    expect(screen.getByText('Call My_OMDB_Agent__0_0_1_tool')).toBeTruthy();
  });

  it('does not re-case prose that already arrived Title Cased', () => {
    render(
      <StageItem
        stage={{ ...baseStage, name: 'Read Weather Data File' }}
        isLive={false}
        typography={{}}
      />,
    );
    expect(screen.getByText('Read Weather Data File')).toBeTruthy();
  });

  it('renders a bare, whitespace-free identifier in monospace', () => {
    render(
      <StageItem
        stage={{ ...baseStage, name: 'My_OMDB_Agent__0_0_1_tool' }}
        isLive={false}
        typography={{}}
      />,
    );
    const nameEl = screen.getByText('My_OMDB_Agent__0_0_1_tool');
    expect(nameEl.className).toMatch(/monoName|mono/i);
  });
});

describe('StageItem — icon priority and failed styling', () => {
  it('gives a failed stage a danger-colored name and an accessible failed label', () => {
    render(
      <StageItem
        stage={{ ...baseStage, status: StageStatus.Failed }}
        isLive={false}
        typography={{}}
      />,
    );
    expect(screen.getByText('Failed')).toBeTruthy();
    const nameEl = screen.getByText('Parsed user intent');
    expect(nameEl.className).toMatch(/stageNameFailed|Failed/);
  });

  it('shows the running spinner for a live unresolved stage', () => {
    render(
      <StageItem
        stage={{ ...baseStage, status: null }}
        isLive
        typography={{}}
      />,
    );
    expect(screen.getByRole('status')).toBeTruthy();
  });
});

describe('StageItem — nameOverride (used for ×N attempts)', () => {
  it('displays the override name while still reading duration from the real stage name', () => {
    render(
      <StageItem
        stage={{ ...baseStage, name: 'Search weather forecast [0.46s]' }}
        nameOverride="Attempt 1"
        isLive={false}
        typography={{}}
      />,
    );
    expect(screen.getByText('Attempt 1')).toBeTruthy();
    expect(screen.getByText('0.46s')).toBeTruthy();
    expect(screen.queryByText('Search weather forecast')).toBeNull();
  });

  it('never treats an override name as an identifier, even if it looks bare', () => {
    render(
      <StageItem
        stage={{ ...baseStage, name: 'x' }}
        nameOverride="Attempt_1"
        isLive={false}
        typography={{}}
      />,
    );
    const nameEl = screen.getByText('Attempt_1');
    expect(nameEl.className).not.toMatch(/monoName/);
  });
});

describe('StageItem — child stages', () => {
  const childList = (
    <ul role="list" aria-label="Child stages">
      <li role="listitem">Child stage</li>
    </ul>
  );

  it('renders a stage with only child stages as a disclosure', async () => {
    const user = userEvent.setup();
    render(
      <StageItem
        stage={{ index: 0, name: 'Plan', status: StageStatus.Completed }}
        isLive={false}
        childList={childList}
      />,
    );

    const button = screen.getByRole('button', { name: /Plan/ });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    await user.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('renders own markdown, then attachments, then child stages', async () => {
    const user = userEvent.setup();
    render(
      <StageItem
        stage={{
          index: 0,
          name: 'Plan',
          status: StageStatus.Completed,
          content: 'Own output',
          attachments: [{ title: 'doc.pdf', url: 'files/doc.pdf' }],
        }}
        isLive={false}
        childList={childList}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Plan/ }));

    const markdown = screen.getByText('Own output');
    const attachment = screen.getByRole('button', { name: 'doc.pdf' });
    const children = screen.getByRole('list', { name: 'Child stages' });
    expect(
      markdown.compareDocumentPosition(attachment) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      attachment.compareDocumentPosition(children) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Plan/ }).contains(children),
    ).toBe(false);
  });

  it('follows a controlled expanded state and reports toggles', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <StageItem
        stage={{ index: 0, name: 'Plan', status: StageStatus.Completed }}
        isLive={false}
        childList={childList}
        isExpanded
        onToggle={onToggle}
      />,
    );

    const button = screen.getByRole('button', { name: /Plan/ });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    await user.click(button);
    expect(onToggle).toHaveBeenCalledWith(false);
  });
});

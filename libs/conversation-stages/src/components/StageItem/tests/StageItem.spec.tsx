import { StageStatus } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StageItem } from '../StageItem';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 14, MD: 16 },
  Spinner: ({ ariaLabel }: { ariaLabel?: string }) => (
    <span role="status" aria-label={ariaLabel} />
  ),
  DialEllipsisTooltip: ({ text }: { text: string }) => <>{text}</>,
}));

vi.mock('@epam/ai-dial-attachment-input', () => ({
  AttachmentCard: ({ attachment }: { attachment: { name: string } }) => (
    <div>{attachment.name}</div>
  ),
}));

const baseStage = {
  index: 0,
  name: 'Parsed user intent',
  status: StageStatus.Completed,
};

describe('StageItem — optional-field rendering', () => {
  it('renders only the icon and name when no other field has data (minimum row)', () => {
    const { container } = render(
      <StageItem stage={baseStage} isLive={false} typography={{}} />,
    );

    expect(screen.getByText('Parsed user intent')).toBeTruthy();
    expect(container.querySelector('button')).toBeNull();
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
    // Exactly one svg (the status icon) — no second svg for a chevron.
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
    const nameEl = screen
      .getByText('My_OMDB_Agent__0_0_1_tool')
      .closest('span');
    expect(nameEl?.className).toMatch(/monoName|mono/i);
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
    const nameEl = screen.getByText('Parsed user intent').closest('span');
    expect(nameEl?.className).toMatch(/stageNameFailed|Failed/);
  });

  it('shows the running spinner when isLive is true, regardless of status', () => {
    render(<StageItem stage={baseStage} isLive typography={{}} />);
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
    const nameEl = screen.getByText('Attempt_1').closest('span');
    expect(nameEl?.className).not.toMatch(/monoName/);
  });
});

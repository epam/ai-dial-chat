import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentTab } from '../Content';

const writeText = vi.fn<(text: string) => Promise<void>>();

Object.defineProperty(navigator, 'clipboard', {
  value: { writeText },
  configurable: true,
});

describe('ContentTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeText.mockResolvedValue(undefined);
  });

  it('renders the body text with whitespace preserved', () => {
    render(<ContentTab content={'line one\n\nline two'} />);

    expect(screen.getByText(/line one/)).toBeTruthy();
    expect(screen.getByText(/line two/)).toBeTruthy();
  });

  it('scrolls the body inside its own container rather than the page', () => {
    render(<ContentTab content="a very long prompt body" />);

    const body = screen.getByText('a very long prompt body');
    expect(body.className).toContain('overflow-auto');
  });

  it('copies the body to the clipboard and announces the confirmation', async () => {
    render(
      <ContentTab
        content="Summarize:"
        copyAriaLabel="Copy content"
        copiedStatusLabel="Copied"
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Copy content' }));

    expect(writeText).toHaveBeenCalledWith('Summarize:');
    expect(screen.getByRole('status').textContent).toBe('Copied');
    /* The button label stays stable so its accessible name never shifts. */
    expect(screen.getByRole('button', { name: 'Copy content' })).toBeTruthy();
  });

  it('announces nothing when the clipboard write is denied', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    render(<ContentTab content="Summarize:" copiedStatusLabel="Copied" />);

    await userEvent.click(screen.getByRole('button', { name: 'Copy content' }));

    expect(screen.getByRole('status').textContent).toBe('');
  });
});

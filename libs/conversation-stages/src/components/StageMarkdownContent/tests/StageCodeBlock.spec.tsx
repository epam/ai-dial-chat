import { copyToClipboard } from '@epam/ai-dial-chat-shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StageCodeBlock } from '../StageCodeBlock';

vi.mock('@epam/ai-dial-chat-shared', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
  mergeClasses: (...args: (string | undefined | false | null)[]) =>
    args.filter(Boolean).join(' '),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16 },
  ElementSize: { Small: 'small' },
  DialGhostIconButton: ({
    onClick,
    icon,
    'aria-label': ariaLabel,
  }: {
    onClick: () => void;
    icon: React.ReactNode;
    'aria-label': string;
  }) => (
    <button onClick={onClick} aria-label={ariaLabel}>
      {icon}
    </button>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconCopy: () => <span>copy-icon</span>,
  IconCheck: () => <span>check-icon</span>,
}));

describe('StageCodeBlock', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the code content', () => {
    render(
      <StageCodeBlock copyAriaLabel="Copy code">
        {'const x = 1;'}
      </StageCodeBlock>,
    );

    expect(screen.getByText('const x = 1;')).toBeTruthy();
  });

  it('renders the copy button with the provided aria-label', () => {
    render(
      <StageCodeBlock copyAriaLabel="Copy snippet">{'hello'}</StageCodeBlock>,
    );

    expect(screen.getByRole('button', { name: 'Copy snippet' })).toBeTruthy();
  });

  it('applies codeClassName to the code element', () => {
    const { container } = render(
      <StageCodeBlock copyAriaLabel="Copy" codeClassName="language-json">
        {'{}'}
      </StageCodeBlock>,
    );

    const code = container.querySelector('code');
    expect(code?.className).toContain('language-json');
  });

  it('calls copyToClipboard with the code text when copy is clicked', async () => {
    render(
      <StageCodeBlock copyAriaLabel="Copy code">
        {'const y = 2;'}
      </StageCodeBlock>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Copy code' }));

    expect(vi.mocked(copyToClipboard)).toHaveBeenCalledOnce();
    expect(vi.mocked(copyToClipboard)).toHaveBeenCalledWith('const y = 2;');
  });

  it('shows the check icon immediately after clicking copy', async () => {
    render(<StageCodeBlock copyAriaLabel="Copy code">{'code'}</StageCodeBlock>);

    expect(screen.getByText('copy-icon')).toBeTruthy();
    expect(screen.queryByText('check-icon')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Copy code' }));

    expect(screen.getByText('check-icon')).toBeTruthy();
    expect(screen.queryByText('copy-icon')).toBeNull();
  });

  it('reverts to the copy icon after 2 seconds', () => {
    vi.useFakeTimers();

    render(<StageCodeBlock copyAriaLabel="Copy code">{'code'}</StageCodeBlock>);

    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    expect(screen.getByText('check-icon')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('copy-icon')).toBeTruthy();
    expect(screen.queryByText('check-icon')).toBeNull();

    vi.useRealTimers();
  });
});

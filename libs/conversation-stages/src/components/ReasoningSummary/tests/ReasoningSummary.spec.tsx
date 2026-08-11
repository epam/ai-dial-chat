import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ReasoningSummary } from '../ReasoningSummary';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 14, MD: 16 },
  DialEllipsisTooltip: ({ text }: { text: string }) => <>{text}</>,
  LinkButton: ({
    label,
    iconAfter,
    onClick,
    className,
    'aria-expanded': ariaExpanded,
    'aria-controls': ariaControls,
    'aria-label': ariaLabel,
  }: {
    label: ReactNode;
    iconAfter?: ReactNode;
    onClick?: () => void;
    className?: string;
    'aria-expanded'?: boolean;
    'aria-controls'?: string;
    'aria-label'?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={className}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-label={ariaLabel}
    >
      {label}
      {iconAfter}
    </button>
  ),
}));

describe('ReasoningSummary', () => {
  it('renders nothing when text is empty', () => {
    const { container } = render(<ReasoningSummary text="" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the provided text through the shared markdown renderer', () => {
    render(<ReasoningSummary text="Checking the weather API" />);
    expect(screen.getByText('Checking the weather API')).toBeTruthy();
  });

  it('renders the default English title when no labels are provided', () => {
    render(<ReasoningSummary text="Some summary" />);
    expect(
      screen.getByRole('button', { name: 'Expand reasoning summary' }),
    ).toBeTruthy();
  });

  it('toggles aria-expanded when the toggle is activated via keyboard/click', async () => {
    render(<ReasoningSummary text="Some summary" />);
    const toggle = screen.getByRole('button', {
      name: 'Expand reasoning summary',
    });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('defaults to expanded while streaming', () => {
    render(<ReasoningSummary text="Streaming text" isStreaming />);
    const toggle = screen.getByRole('button', {
      name: 'Collapse reasoning summary',
    });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('renders custom labels when provided', () => {
    render(
      <ReasoningSummary
        text="Custom"
        labels={{
          title: 'Résumé du raisonnement',
          expandAriaLabel: 'Développer',
          collapseAriaLabel: 'Réduire',
        }}
      />,
    );
    expect(screen.getByText('Résumé du raisonnement')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Développer' })).toBeTruthy();
  });
});

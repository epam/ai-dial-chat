import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConversationPanel } from '../ConversationPanel.js';
import type { ConversationHistoryItem } from '../../../models/ConversationPanel.js';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { LG: 24 },
  DialGhostIconButton: ({
    onClick,
    'aria-label': ariaLabel,
  }: {
    onClick: () => void;
    'aria-label': string;
  }) => (
    <button onClick={onClick} aria-label={ariaLabel}>
      toggle
    </button>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconLayoutSidebarLeftCollapse: () => <span>collapse-icon</span>,
  IconLayoutSidebarLeftExpand: () => <span>expand-icon</span>,
}));

const BASE_PROPS = {
  isOpen: true,
  onToggle: vi.fn(),
  onSelectConversation: vi.fn(),
  title: 'Conversations',
  toggleAriaLabel: 'Toggle panel',
  emptyLabel: 'No conversations yet',
  formatDate: (d: string) => d,
};

const items: ConversationHistoryItem[] = [
  { id: 'c1', title: 'First chat', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'c2', title: 'Second chat', updatedAt: '2026-01-02T00:00:00Z' },
  { id: 'c3', title: 'Third chat', updatedAt: '2026-01-03T00:00:00Z' },
];

describe('ConversationPanel', () => {
  it('renders all conversation rows when open', () => {
    render(<ConversationPanel {...BASE_PROPS} conversations={items} />);
    expect(screen.getByRole('list')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('First chat')).toBeTruthy();
    expect(screen.getByText('Second chat')).toBeTruthy();
  });

  it('shows empty label when conversations is empty', () => {
    render(<ConversationPanel {...BASE_PROPS} conversations={[]} />);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText('No conversations yet')).toBeTruthy();
  });

  it('marks the active conversation with aria-current="page"', () => {
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={items}
        activeConversationId="c2"
      />,
    );
    const buttons = screen.getAllByRole('button');
    const activeBtn = buttons.find(
      (b) => b.getAttribute('aria-current') === 'page',
    );
    expect(activeBtn).toBeTruthy();
    expect(activeBtn?.textContent).toContain('Second chat');
  });

  it('calls onSelectConversation with the correct id', () => {
    const onSelect = vi.fn();
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={items}
        onSelectConversation={onSelect}
      />,
    );
    fireEvent.click(screen.getByText('Third chat'));
    expect(onSelect).toHaveBeenCalledWith('c3');
  });

  it('calls onToggle when the toggle button is clicked', () => {
    const onToggle = vi.fn();
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={items}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Toggle panel' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('sets aria-expanded to false when isOpen is false', () => {
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={items}
        isOpen={false}
      />,
    );
    const aside = screen.getByRole('complementary');
    expect(aside.getAttribute('aria-expanded')).toBe('false');
  });

  it('calls onBackdropClick when the backdrop is clicked', () => {
    const onBackdropClick = vi.fn();
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={items}
        onBackdropClick={onBackdropClick}
      />,
    );
    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onBackdropClick).toHaveBeenCalledTimes(1);
  });

  it('does not render backdrop when isOpen is false', () => {
    render(
      <ConversationPanel
        {...BASE_PROPS}
        conversations={items}
        isOpen={false}
        onBackdropClick={vi.fn()}
      />,
    );
    expect(document.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});

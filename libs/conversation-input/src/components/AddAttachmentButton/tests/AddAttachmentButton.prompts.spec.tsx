import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddAttachmentButton } from '../AddAttachmentButton';

const { mockUseIsMobile } = vi.hoisted(() => ({
  mockUseIsMobile: vi.fn(() => false),
}));

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return { ...actual, useIsMobile: mockUseIsMobile };
});

const baseProps = {
  attachLabel: 'Attach file',
  addMenuTitle: 'Add',
  menuTitle: 'Menu',
  menuCloseLabel: 'Close',
};

describe('AddAttachmentButton — prompts submenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
  });

  it('does not render a Prompts item when promptsMenuOverlay is absent', async () => {
    render(<AddAttachmentButton {...baseProps} onAttachClick={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Add'));

    expect(await screen.findByText('Attach file')).toBeTruthy();
    expect(screen.queryByText('Prompts')).toBeNull();
  });

  it('renders a Prompts item when promptsMenuOverlay is provided', async () => {
    render(
      <AddAttachmentButton
        {...baseProps}
        onAttachClick={vi.fn()}
        promptsMenuOverlay={() => <div>Prompts overlay content</div>}
      />,
    );
    fireEvent.click(screen.getByLabelText('Add'));

    expect(await screen.findByText('Prompts')).toBeTruthy();
  });

  it('renders the overlay content in the desktop flyout on hover', async () => {
    const user = userEvent.setup();
    render(
      <AddAttachmentButton
        {...baseProps}
        onAttachClick={vi.fn()}
        promptsMenuOverlay={() => <div>Prompts overlay content</div>}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add' }));
    const promptsTrigger = await screen.findByRole('menuitem', {
      name: 'Prompts',
    });
    promptsTrigger.focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByText('Prompts overlay content')).toBeTruthy();
  });

  describe('mobile path', () => {
    beforeEach(() => {
      mockUseIsMobile.mockReturnValue(true);
    });

    it('opens a bottom sheet with the overlay content when Prompts is tapped', async () => {
      render(
        <AddAttachmentButton
          {...baseProps}
          onAttachClick={vi.fn()}
          promptsMenuOverlay={() => <div>Prompts overlay content</div>}
          promptsMenuTitle="Prompts"
        />,
      );

      fireEvent.click(screen.getByLabelText('Add'));
      fireEvent.click(await screen.findByText('Prompts'));

      expect(await screen.findByText('Prompts overlay content')).toBeTruthy();
      expect(screen.getByRole('dialog', { name: 'Prompts' })).toBeTruthy();
    });

    it('returns to the main Add sheet when the back button is clicked', async () => {
      render(
        <AddAttachmentButton
          {...baseProps}
          onAttachClick={vi.fn()}
          promptsMenuOverlay={() => <div>Prompts overlay content</div>}
          promptsMenuTitle="Prompts"
          promptsBackLabel="Back"
        />,
      );

      fireEvent.click(screen.getByLabelText('Add'));
      fireEvent.click(await screen.findByText('Prompts'));
      fireEvent.click(await screen.findByLabelText('Back'));

      expect(await screen.findByText('Attach file')).toBeTruthy();
      expect(screen.queryByText('Prompts overlay content')).toBeNull();
    });
  });
});

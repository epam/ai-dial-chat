import { fireEvent, render, screen } from '@testing-library/react';
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

const singleToolItem = {
  id: 'deep_research',
  label: 'Deep Research',
  icon: null,
  isSelected: false,
};

describe('AddAttachmentButton — tools submenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
  });

  it('does not render a Tools item when toolsMenuItems is empty', async () => {
    render(
      <AddAttachmentButton
        {...baseProps}
        onAttachClick={vi.fn()}
        toolsMenuItems={[]}
        onToolToggle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Add'));
    expect(await screen.findByText('Attach file')).toBeTruthy();
    expect(screen.queryByText('Tools')).toBeNull();
  });

  it('does not render a Tools item when onToolToggle is absent', async () => {
    render(
      <AddAttachmentButton
        {...baseProps}
        onAttachClick={vi.fn()}
        toolsMenuItems={[singleToolItem]}
      />,
    );
    fireEvent.click(screen.getByLabelText('Add'));
    expect(await screen.findByText('Attach file')).toBeTruthy();
    expect(screen.queryByText('Tools')).toBeNull();
  });

  it('renders a Tools item when toolsMenuItems is non-empty and onToolToggle is provided', async () => {
    render(
      <AddAttachmentButton
        {...baseProps}
        onAttachClick={vi.fn()}
        toolsMenuItems={[singleToolItem]}
        onToolToggle={vi.fn()}
        toolsMenuTitle="Tools"
      />,
    );
    fireEvent.click(screen.getByLabelText('Add'));
    expect(await screen.findByText('Tools')).toBeTruthy();
  });

  describe('mobile path', () => {
    beforeEach(() => {
      mockUseIsMobile.mockReturnValue(true);
    });

    it('calls onToolToggle with the tool id when a tool row is tapped', async () => {
      const handleToggle = vi.fn();
      render(
        <AddAttachmentButton
          {...baseProps}
          onAttachClick={vi.fn()}
          toolsMenuItems={[singleToolItem]}
          onToolToggle={handleToggle}
          toolsMenuTitle="Tools"
        />,
      );

      fireEvent.click(screen.getByLabelText('Add'));
      fireEvent.click(await screen.findByText('Tools'));
      fireEvent.click(await screen.findByText('Deep Research'));

      expect(handleToggle).toHaveBeenCalledWith('deep_research');
    });

    it('reflects isSelected=true as aria-checked on the tool row', async () => {
      render(
        <AddAttachmentButton
          {...baseProps}
          toolsMenuItems={[{ ...singleToolItem, isSelected: true }]}
          onToolToggle={vi.fn()}
          toolsMenuTitle="Tools"
        />,
      );

      fireEvent.click(screen.getByLabelText('Add'));
      fireEvent.click(await screen.findByText('Tools'));

      const row = (await screen.findByText('Deep Research')).closest('button');
      expect(row?.getAttribute('aria-checked')).toBe('true');
    });

    it('reflects isSelected=false as aria-checked on the tool row', async () => {
      render(
        <AddAttachmentButton
          {...baseProps}
          toolsMenuItems={[{ ...singleToolItem, isSelected: false }]}
          onToolToggle={vi.fn()}
          toolsMenuTitle="Tools"
        />,
      );

      fireEvent.click(screen.getByLabelText('Add'));
      fireEvent.click(await screen.findByText('Tools'));

      const row = (await screen.findByText('Deep Research')).closest('button');
      expect(row?.getAttribute('aria-checked')).toBe('false');
    });
  });
});

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddAttachmentButton } from '../AddAttachmentButton';

const { mockUseIsMobile } = vi.hoisted(() => ({
  mockUseIsMobile: vi.fn(() => false),
}));

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return {
    ...actual,
    useIsMobile: mockUseIsMobile,
    useIsPhone: mockUseIsMobile,
  };
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

  describe('desktop keyboard interaction', () => {
    it('navigates tool rows with arrow keys and Home/End', async () => {
      const user = userEvent.setup();
      render(
        <AddAttachmentButton
          {...baseProps}
          toolsMenuItems={[
            singleToolItem,
            { ...singleToolItem, id: 'second', label: 'Second tool' },
          ]}
          onToolToggle={vi.fn()}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Add' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Tools' }));
      const first = await screen.findByRole('menuitemcheckbox', {
        name: 'Deep Research',
      });
      const second = screen.getByRole('menuitemcheckbox', {
        name: 'Second tool',
      });
      act(() => first.focus());
      await user.keyboard('{ArrowDown}');
      expect(second.matches(':focus')).toBe(true);
      await user.keyboard('{Home}');
      expect(first.matches(':focus')).toBe(true);
      await user.keyboard('{End}');
      expect(second.matches(':focus')).toBe(true);
    });

    it('keeps the active Tools submenu across phone/tablet transitions', async () => {
      const user = userEvent.setup();
      mockUseIsMobile.mockReturnValue(true);
      const props = {
        ...baseProps,
        toolsMenuItems: [singleToolItem],
        onToolToggle: vi.fn(),
      };
      const { rerender } = render(<AddAttachmentButton {...props} />);
      await user.click(screen.getByRole('button', { name: 'Add' }));
      await user.click(await screen.findByText('Tools'));
      for (const phone of [false, true, false]) {
        mockUseIsMobile.mockReturnValue(phone);
        rerender(<AddAttachmentButton {...props} />);
        const row = await screen.findByRole('menuitemcheckbox', {
          name: 'Deep Research',
        });
        await user.click(row);
      }
      expect(props.onToolToggle).toHaveBeenCalledTimes(3);
    });

    it.each([
      ['Enter', '{Enter}'],
      ['Space', ' '],
    ])('opens the Tools submenu with %s', async (_keyName, key) => {
      const user = userEvent.setup();
      render(
        <AddAttachmentButton
          {...baseProps}
          onAttachClick={vi.fn()}
          toolsMenuItems={[singleToolItem]}
          onToolToggle={vi.fn()}
          toolsMenuTitle="Tools"
        />,
      );

      await user.tab();
      await user.keyboard('{Enter}');
      const toolsTrigger = await screen.findByRole('menuitem', {
        name: 'Tools',
      });
      expect(screen.getByRole('menu', { name: 'Add' })).toBeTruthy();
      await waitFor(() =>
        expect(
          screen
            .getByRole('menuitem', { name: 'Attach file' })
            .matches(':focus'),
        ).toBe(true),
      );
      await user.keyboard('{ArrowDown}');
      expect(toolsTrigger.matches(':focus')).toBe(true);
      await user.keyboard(key);

      expect(
        await screen.findByRole('menuitemcheckbox', { name: 'Deep Research' }),
      ).toBeTruthy();
      expect(toolsTrigger.getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByRole('menu', { name: 'Tools' })).toBeTruthy();
    });

    it('reflects isSelected as aria-checked on the desktop tool row', async () => {
      const user = userEvent.setup();
      render(
        <AddAttachmentButton
          {...baseProps}
          onAttachClick={vi.fn()}
          toolsMenuItems={[{ ...singleToolItem, isSelected: true }]}
          onToolToggle={vi.fn()}
          toolsMenuTitle="Tools"
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Add' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Tools' }));

      const row = await screen.findByRole('menuitemcheckbox', {
        name: 'Deep Research',
      });
      expect(row.getAttribute('aria-checked')).toBe('true');
    });

    it('keeps the Tools submenu open after a tool is toggled', async () => {
      const user = userEvent.setup();
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

      await user.click(screen.getByRole('button', { name: 'Add' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Tools' }));
      await user.click(
        await screen.findByRole('menuitemcheckbox', { name: 'Deep Research' }),
      );

      expect(handleToggle).toHaveBeenCalledWith('deep_research');
      expect(
        screen.getByRole('menuitemcheckbox', { name: 'Deep Research' }),
      ).toBeTruthy();
    });

    it('closes only the Tools submenu with Escape and returns focus to its trigger', async () => {
      const user = userEvent.setup();
      render(
        <AddAttachmentButton
          {...baseProps}
          onAttachClick={vi.fn()}
          toolsMenuItems={[singleToolItem]}
          onToolToggle={vi.fn()}
          toolsMenuTitle="Tools"
        />,
      );

      await user.tab();
      await user.keyboard('{Enter}');
      const toolsTrigger = await screen.findByRole('menuitem', {
        name: 'Tools',
      });
      await waitFor(() =>
        expect(
          screen
            .getByRole('menuitem', { name: 'Attach file' })
            .matches(':focus'),
        ).toBe(true),
      );
      await user.keyboard('{ArrowDown}');
      expect(toolsTrigger.matches(':focus')).toBe(true);
      await user.keyboard('{Enter}');
      const toolItem = await screen.findByRole('menuitemcheckbox', {
        name: 'Deep Research',
      });
      act(() => toolItem.focus());

      await user.keyboard('{Escape}');

      expect(
        screen.queryByRole('menuitemcheckbox', { name: 'Deep Research' }),
      ).toBeNull();
      expect(
        screen.getByRole('menuitem', { name: 'Attach file' }),
      ).toBeTruthy();
      expect(toolsTrigger.getAttribute('aria-expanded')).toBe('false');
      expect(toolsTrigger.matches(':focus')).toBe(true);
    });
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

      const row = await screen.findByRole('menuitemcheckbox', {
        name: 'Deep Research',
      });
      expect(row.getAttribute('aria-checked')).toBe('true');
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

      const row = await screen.findByRole('menuitemcheckbox', {
        name: 'Deep Research',
      });
      expect(row.getAttribute('aria-checked')).toBe('false');
    });
  });
});

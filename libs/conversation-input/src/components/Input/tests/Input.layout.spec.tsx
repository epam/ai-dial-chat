import type { ToolMenuItem } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionRowLayout } from '../../../models/Input';
import { Input } from '../Input';

const { mockUseIsMobile } = vi.hoisted(() => ({
  mockUseIsMobile: vi.fn(() => false),
}));

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return { ...actual, useIsMobile: mockUseIsMobile };
});

/*
 * The row containers carry no role or text of their own, so the layout is
 * asserted through element relationships (who contains whom, and in which
 * document order) rather than through Tailwind class strings, which would
 * re-freeze the very classes this change removed.
 */
const getParent = (element: Element): HTMLElement =>
  // eslint-disable-next-line testing-library/no-node-access
  element.parentElement as HTMLElement;

const expectTextareaOwnsItsRow = (): void => {
  const textarea = screen.getByRole('textbox');
  const addButton = screen.getByLabelText('Add');
  const textareaCell = getParent(textarea);

  /* The textarea sits in a cell of its own — the + button is not in it. */
  expect(textareaCell.contains(addButton)).toBe(false);
  /* …and that cell is a sibling of the controls, inside the same wrap row. */
  expect(getParent(textareaCell).contains(addButton)).toBe(true);
  /* The textarea comes first, so DOM order matches the visual order. */
  expect(
    textarea.compareDocumentPosition(addButton) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
};

const buildTool = (id: string, label: string): ToolMenuItem => ({
  id,
  label,
  icon: null,
  isSelected: false,
});

describe('Input — layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
  });

  it('puts the textarea on its own row for an empty input with no tools or attachments', () => {
    render(<Input />);

    expectTextareaOwnsItsRow();
  });

  it('keeps the same layout on mobile', () => {
    mockUseIsMobile.mockReturnValue(true);
    render(<Input />);

    expectTextareaOwnsItsRow();
  });

  it('does not reflow when the message grows to several lines', () => {
    render(<Input />);
    expectTextareaOwnsItsRow();

    const textarea = screen.getByRole('textbox');
    const textareaCell = getParent(textarea);
    const addButton = screen.getByLabelText('Add');
    const controlsRow = getParent(addButton);

    fireEvent.change(textarea, { target: { value: 'first line\nsecond' } });

    expect((textarea as HTMLTextAreaElement).value).toContain('\n');
    /* Same nodes in the same relationship — nothing moved. */
    expect(getParent(screen.getByRole('textbox'))).toBe(textareaCell);
    expect(getParent(screen.getByLabelText('Add'))).toBe(controlsRow);
    expectTextareaOwnsItsRow();
  });

  it('renders the textarea with an empty message when the action bar is hidden', () => {
    render(<Input hideActionBar />);

    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(screen.queryByLabelText('Add')).toBeNull();
  });

  it('renders the tools chips between the textarea and the trailing actions', () => {
    render(
      <Input
        toolsMenuItems={[buildTool('web_search', 'Web Search')]}
        onToolToggle={vi.fn()}
        renderFooterActions={() => <button type="button">Send it</button>}
      />,
    );

    const textarea = screen.getByRole('textbox');
    const chip = screen.getByRole('button', { name: 'Web Search' });
    const trailingAction = screen.getByRole('button', { name: 'Send it' });

    expect(
      textarea.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      chip.compareDocumentPosition(trailingAction) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    /* The chips sit in their own cell, not inside the trailing actions. */
    expect(getParent(chip).contains(trailingAction)).toBe(false);
  });
  describe('inline action row', () => {
    it('puts the add button before the textarea, in the same row', () => {
      render(<Input actionRowLayout={ActionRowLayout.Inline} />);

      const textarea = screen.getByRole('textbox');
      const addButton = screen.getByLabelText('Add');

      /* Same row as the textarea cell — the row no longer wraps. */
      expect(getParent(getParent(textarea)).contains(addButton)).toBe(true);
      /*
       * The add button comes first in the DOM, so the tab order matches the
       * visual order without any `order-*` utility.
       */
      expect(
        addButton.compareDocumentPosition(textarea) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('falls back to the stacked layout on mobile', () => {
      mockUseIsMobile.mockReturnValue(true);
      render(<Input actionRowLayout={ActionRowLayout.Inline} />);

      expectTextareaOwnsItsRow();
    });

    it('keeps the inline layout below the desktop breakpoint when the host opts in', () => {
      mockUseIsMobile.mockReturnValue(true);
      render(
        <Input
          actionRowLayout={ActionRowLayout.Inline}
          isInlineActionRowAllowedBelowDesktop
        />,
      );

      const textarea = screen.getByRole('textbox');
      const addButton = screen.getByLabelText('Add');

      expect(getParent(getParent(textarea)).contains(addButton)).toBe(true);
    });

    it('ignores the opt-in while the layout is stacked', () => {
      mockUseIsMobile.mockReturnValue(true);
      render(
        <Input
          actionRowLayout={ActionRowLayout.Stacked}
          isInlineActionRowAllowedBelowDesktop
        />,
      );

      expectTextareaOwnsItsRow();
    });

    it('moves the tool chips out of the action row', () => {
      render(
        <Input
          actionRowLayout={ActionRowLayout.Inline}
          toolsMenuItems={[buildTool('web', 'Web Search')]}
          onToolToggle={vi.fn()}
        />,
      );

      const chip = screen.getByRole('button', { name: 'Web Search' });
      const addButton = screen.getByLabelText('Add');
      /* The textarea cell's parent is the action row — see the helper above. */
      const actionRow = getParent(getParent(screen.getByRole('textbox')));

      expect(actionRow.contains(chip)).toBe(false);
      expect(actionRow.contains(addButton)).toBe(true);
      /* The chips row comes before the action row. */
      expect(
        chip.compareDocumentPosition(addButton) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('keeps the tool chips inside the action row when stacked', () => {
      render(
        <Input
          toolsMenuItems={[buildTool('web', 'Web Search')]}
          onToolToggle={vi.fn()}
        />,
      );

      const chip = screen.getByRole('button', { name: 'Web Search' });
      const actionRow = getParent(getParent(screen.getByRole('textbox')));

      expect(actionRow.contains(chip)).toBe(true);
    });
  });
});

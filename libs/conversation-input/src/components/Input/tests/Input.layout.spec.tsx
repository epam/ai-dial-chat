import type { ToolMenuItem } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('does not reflow when the message grows to several lines', async () => {
    render(<Input />);
    expectTextareaOwnsItsRow();

    const textarea = screen.getByRole('textbox');
    const textareaCell = getParent(textarea);
    const addButton = screen.getByLabelText('Add');
    const controlsRow = getParent(addButton);

    await userEvent.type(textarea, 'first line{shift>}{enter}{/shift}second');

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
});

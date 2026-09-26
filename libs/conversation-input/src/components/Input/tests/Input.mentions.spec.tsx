import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Input } from '../Input';

describe('Input — skill mention highlighting', () => {
  it('renders each active mention range as a highlighted run over the real text', () => {
    render(
      <Input
        message="/report please summarize /report again"
        activeMentions={[
          { start: 0, length: 7 },
          { start: 25, length: 7 },
        ]}
      />,
    );

    /* The textarea is aria-hidden while a mention is active — the mirror's
       un-hidden ChatSkill chip carries the accessible name instead — so the
       role query must opt into hidden elements here. */
    const textarea = screen.getByRole('textbox', {
      hidden: true,
    }) as HTMLTextAreaElement;
    expect(textarea.value).toBe('/report please summarize /report again');
    expect(textarea.className).toContain('textareaMentionMode');

    const highlighted = screen.getAllByText('/report');
    expect(highlighted).toHaveLength(2);
    /* The mirror is a non-interactive, aria-hidden sibling — the real text
       lives only in the textarea's own value. */
    highlighted.forEach((node) => {
      // eslint-disable-next-line testing-library/no-node-access -- confirming the highlighted run sits inside the aria-hidden mirror has no semantic query.
      expect(node.closest('[aria-hidden="true"]')).toBeTruthy();
    });
  });

  it('renders unchanged (no mention-mode class) when no mentions are active', () => {
    render(<Input message="plain text" />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('plain text');
    expect(textarea.className).not.toContain('textareaMentionMode');
  });

  it('renders highlighted runs the same way under an RTL ancestor', () => {
    render(
      <div dir="rtl">
        <Input
          message="/report مرحبا"
          activeMentions={[{ start: 0, length: 7 }]}
        />
      </div>,
    );

    expect(screen.getByText('/report')).toBeTruthy();
    expect(
      (screen.getByRole('textbox', { hidden: true }) as HTMLTextAreaElement)
        .value,
    ).toBe('/report مرحبا');
  });
});

describe('Input — whole-mention Backspace', () => {
  it('deletes the entire mention when Backspace lands exactly at its trailing boundary', () => {
    const onChange = vi.fn();
    const onBackspaceAtCaret = vi.fn(() => ({ start: 6, length: 7 }));
    render(
      <Input
        message="hello /report world"
        activeMentions={[{ start: 6, length: 7 }]}
        onBackspaceAtCaret={onBackspaceAtCaret}
        onChange={onChange}
      />,
    );
    const textarea = screen.getByRole('textbox', {
      hidden: true,
    }) as HTMLTextAreaElement;
    textarea.setSelectionRange(13, 13);

    fireEvent.keyDown(textarea, { key: 'Backspace' });

    expect(onBackspaceAtCaret).toHaveBeenCalledWith(13);
    expect(textarea.value).toBe('hello  world');
    expect(onChange).toHaveBeenCalledWith('hello  world');
  });

  it('leaves ordinary Backspace alone when the caret is not at a mention boundary', () => {
    const onBackspaceAtCaret = vi.fn(() => undefined);
    render(
      <Input
        message="hello /report world"
        activeMentions={[{ start: 6, length: 7 }]}
        onBackspaceAtCaret={onBackspaceAtCaret}
      />,
    );
    const textarea = screen.getByRole('textbox', {
      hidden: true,
    }) as HTMLTextAreaElement;
    textarea.setSelectionRange(9, 9);

    const notPrevented = fireEvent.keyDown(textarea, { key: 'Backspace' });

    expect(onBackspaceAtCaret).toHaveBeenCalledWith(9);
    /* `fireEvent` reports `true` when the event's default was not prevented. */
    expect(notPrevented).toBe(true);
    expect(textarea.value).toBe('hello /report world');
  });

  it('does nothing extra when onBackspaceAtCaret is absent', () => {
    render(<Input message="hello /report world" />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    textarea.setSelectionRange(13, 13);

    const notPrevented = fireEvent.keyDown(textarea, { key: 'Backspace' });

    expect(notPrevented).toBe(true);
    expect(textarea.value).toBe('hello /report world');
  });
});

describe('Input — caretPositionOverride', () => {
  it('places the caret at the given offset once messageRevision changes', async () => {
    const { rerender } = render(
      <Input message="hello world" messageRevision={0} />,
    );
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    rerender(
      <Input
        message="hello /report world"
        messageRevision={1}
        activeMentions={[{ start: 6, length: 7 }]}
        caretPositionOverride={13}
      />,
    );
    await waitFor(() => expect(textarea.value).toBe('hello /report world'));

    expect(textarea.selectionStart).toBe(13);
    expect(textarea.selectionEnd).toBe(13);
  });

  it('never calls setSelectionRange for the override when caretPositionOverride is absent', async () => {
    const { rerender } = render(
      <Input message="hello world" messageRevision={0} />,
    );
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    const setSelectionRange = vi.spyOn(textarea, 'setSelectionRange');

    rerender(<Input message="hello world!" messageRevision={1} />);
    await waitFor(() => expect(textarea.value).toBe('hello world!'));

    expect(setSelectionRange).not.toHaveBeenCalled();
  });
});

import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Input } from '../Input';

const getTextarea = () =>
  screen.getByRole('textbox', { hidden: true }) as HTMLTextAreaElement;

const flushMicrotasks = () => act(async () => Promise.resolve());

describe('Input — caret after mounting with a message', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('puts the caret at the end of an initial message when autofocused', () => {
    render(<Input message="/my-skill " autoFocus />);

    const textarea = getTextarea();
    expect(textarea.selectionStart).toBe('/my-skill '.length);
    expect(textarea.selectionEnd).toBe('/my-skill '.length);
  });

  it('does not touch the selection of a composer that is not focused', () => {
    const setSelectionRange = vi.spyOn(
      HTMLTextAreaElement.prototype,
      'setSelectionRange',
    );

    render(<Input message="/my-skill " />);

    expect(setSelectionRange).not.toHaveBeenCalled();
  });

  it('leaves an empty composer alone', () => {
    render(<Input autoFocus />);

    expect(getTextarea().selectionStart).toBe(0);
  });
});

describe('Input — inserting text into a composer the user never focused', () => {
  it('inserts after the existing text instead of in front of it', async () => {
    const { rerender } = render(<Input message="/my-skill " />);

    rerender(
      <Input
        message="/my-skill "
        textInsertion={{ text: 'Summarize', revision: 1 }}
      />,
    );
    await flushMicrotasks();

    expect(getTextarea().value).toBe('/my-skill Summarize');
  });

  it('inserts at the caret the user left behind after focusing and leaving', async () => {
    const { rerender } = render(<Input message="/my-skill " />);
    const textarea = getTextarea();
    act(() => {
      textarea.focus();
      textarea.setSelectionRange(3, 3);
      textarea.blur();
    });

    rerender(
      <Input message="/my-skill " textInsertion={{ text: '|', revision: 1 }} />,
    );
    await flushMicrotasks();

    expect(getTextarea().value).toBe('/my|-skill ');
  });

  it('inserts at a start-of-text caret the host placed through caretPositionOverride', async () => {
    const { rerender } = render(
      <Input
        message="/my-skill "
        messageRevision={1}
        caretPositionOverride={0}
      />,
    );

    rerender(
      <Input
        message="/my-skill "
        messageRevision={1}
        caretPositionOverride={0}
        textInsertion={{ text: '|', revision: 1 }}
      />,
    );
    await flushMicrotasks();

    expect(getTextarea().value).toBe('|/my-skill ');
  });
});

/* eslint-disable testing-library/no-node-access -- Native Selection/Range requires DOM text nodes and refs. */
import { CitationMarker } from '@epam/ai-dial-quotations';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMessageSelectionReply } from '../useMessageSelectionReply';

const RECT = new DOMRect(50, 100, 120, 20);
const noFiles: File[] = [];
const consume = vi.fn();

beforeEach(() => {
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [RECT],
  });
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: 360,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    value: 800,
  });
});
afterEach(() => {
  window.getSelection()?.removeAllRanges();
  vi.restoreAllMocks();
});

const select = (element: HTMLElement) => {
  const range = document.createRange();
  range.selectNodeContents(element);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  fireEvent(document, new Event('selectionchange'));
};

const Harness = ({
  enabled = true,
  conversationId = 'one',
  text = '  مرحبا 😀\nselected text  ',
}) => {
  const { contentRef, actionRef, selection, onReply, pendingFiles } =
    useMessageSelectionReply({
      conversationId,
      enabled,
      droppedFiles: noFiles,
      onDroppedFilesConsumed: consume,
    });
  const [fileText, setFileText] = useState('');
  return (
    <>
      <div ref={contentRef}>
        <p aria-label="Message passage">{text}</p>
        <pre>
          <code>const answer = 42;</code>
        </pre>
        <table>
          <tbody>
            <tr>
              <td>Visible cell</td>
            </tr>
          </tbody>
        </table>
        <button>Excluded</button>
        <p aria-label="Annotated passage">
          Before{' '}
          <CitationMarker
            sourceName="Source"
            annotationCount={1}
            onOpen={vi.fn()}
            labels={{
              ariaLabel: 'Source annotation',
              label: '[1]',
              labelWithOverflow: '[1+]',
            }}
            icon={<span aria-hidden="true">*</span>}
          />{' '}
          after <a href="#source">link</a>.
        </p>
      </div>
      <div ref={contentRef}>
        <p>Other message</p>
      </div>
      {selection && (
        <div ref={actionRef}>
          <button onClick={onReply}>Reply</button>
        </div>
      )}
      <output aria-label="Pending files">{pendingFiles.length}</output>
      <button onClick={async () => setFileText(await pendingFiles[0].text())}>
        Read file
      </button>
      <output aria-label="File text">{fileText}</output>
    </>
  );
};

describe('useMessageSelectionReply', () => {
  it('leaves Tab navigation intact while the host action has no portal destination', async () => {
    const { result } = renderHook(() =>
      useMessageSelectionReply({
        conversationId: 'one',
        enabled: true,
        droppedFiles: noFiles,
        onDroppedFilesConsumed: consume,
      }),
    );
    render(<div ref={result.current.contentRef}>Selected message</div>);
    select(screen.getByText('Selected message'));
    await waitFor(() => expect(result.current.selection).not.toBeNull());
    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    fireEvent(document, tab);
    expect(tab.defaultPrevented).toBe(false);
  });

  it('allows prose spanning citation buttons, decorative icons and links, preserving native selected text', async () => {
    render(<Harness />);
    select(screen.getByLabelText('Annotated passage'));
    const selectedText = window.getSelection()?.toString();
    fireEvent.click(await screen.findByRole('button', { name: 'Reply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Read file' }));
    await waitFor(() =>
      expect(screen.getByLabelText('File text').textContent).toBe(selectedText),
    );
  });

  it('does not offer Reply for a citation label alone', async () => {
    render(<Harness />);
    select(screen.getByText('[1]'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
  });
  it('attaches exact visible Unicode and whitespace once, without surrounding controls', async () => {
    render(<Harness />);
    select(screen.getByText('مرحبا 😀 selected text'));
    fireEvent.click(await screen.findByRole('button', { name: 'Reply' }));
    expect(screen.getByLabelText('Pending files').textContent).toBe('1');
    expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Read file' }));
    await waitFor(() =>
      expect(screen.getByLabelText('File text').textContent).toBe(
        '  مرحبا 😀\nselected text  ',
      ),
    );
  });

  it('ignores whitespace and selections crossing message bodies or controls', async () => {
    const { rerender } = render(<Harness text="   " />);
    select(screen.getByLabelText('Message passage'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
    const excluded = screen.getByRole('button', { name: 'Excluded' });
    select(excluded);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
    rerender(<Harness text="First message" />);
    const range = document.createRange();
    range.setStart(screen.getByText('First message').firstChild!, 0);
    range.setEnd(screen.getByText('Other message').firstChild!, 4);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    fireEvent(document, new Event('selectionchange'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
  });

  it.each(['const answer = 42;', 'Visible cell'])(
    'accepts rendered code and table text: %s',
    async (text) => {
      render(<Harness />);
      select(screen.getByText(text));
      fireEvent.click(await screen.findByRole('button', { name: 'Reply' }));
      fireEvent.click(screen.getByRole('button', { name: 'Read file' }));
      await waitFor(() =>
        expect(screen.getByLabelText('File text').textContent).toBe(text),
      );
    },
  );

  it('dismisses on outside interaction but permits deliberately selecting the same passage again', async () => {
    render(<Harness text="Passage" />);
    const passage = screen.getByText('Passage');
    select(passage);
    await screen.findByRole('button', { name: 'Reply' });
    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
    for (let count = 1; count <= 2; count++) {
      fireEvent.pointerDown(passage);
      select(passage);
      fireEvent.pointerUp(passage);
      fireEvent.click(await screen.findByRole('button', { name: 'Reply' }));
      expect(screen.getByLabelText('Pending files').textContent).toBe(
        String(count),
      );
    }
  });

  it('keeps the snapshot when tabbing onto Reply and dismisses it with Escape', async () => {
    render(<Harness text="Passage" />);
    select(screen.getByText('Passage'));
    const button = await screen.findByRole('button', { name: 'Reply' });
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(button);
    window.getSelection()?.removeAllRanges();
    fireEvent(document, new Event('selectionchange'));
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
    expect(screen.getByLabelText('Pending files').textContent).toBe('0');
  });

  it('waits for pointer release on every selection, hiding the previous Reply while dragging', async () => {
    render(<Harness text="Passage" />);
    const passage = screen.getByText('Passage');
    for (let attempt = 0; attempt < 3; attempt++) {
      fireEvent.pointerDown(passage);
      select(passage);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
      });
      expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
      fireEvent.pointerUp(document);
      await screen.findByRole('button', { name: 'Reply' });
    }
  });

  it('waits until Shift is released after keyboard selection', async () => {
    render(<Harness text="Passage" />);
    select(screen.getByText('Passage'));
    await screen.findByRole('button', { name: 'Reply' });
    fireEvent.keyDown(document, { key: 'ArrowRight', shiftKey: true });
    select(screen.getByText('Passage'));
    fireEvent.keyUp(document, { key: 'ArrowRight', shiftKey: true });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
    fireEvent.keyUp(document, { key: 'Shift' });
    await screen.findByRole('button', { name: 'Reply' });
  });

  it.each(['pointercancel', 'blur'])(
    'recovers after selection is interrupted by %s',
    async (event) => {
      render(<Harness text="Passage" />);
      const passage = screen.getByText('Passage');
      fireEvent.pointerDown(passage);
      select(passage);
      fireEvent(event === 'blur' ? window : document, new Event(event));
      fireEvent(document, new Event('selectionchange'));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
      });
      expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
      fireEvent.pointerDown(passage);
      select(passage);
      fireEvent.pointerUp(passage);
      await screen.findByRole('button', { name: 'Reply' });
    },
  );

  it('drops stale selection when the conversation, eligibility or source changes', async () => {
    const { rerender } = render(<Harness text="Passage" />);
    select(screen.getByText('Passage'));
    await screen.findByRole('button', { name: 'Reply' });
    rerender(<Harness text="Passage" enabled={false} />);
    expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
    rerender(<Harness text="Passage" />);
    select(screen.getByText('Other message'));
    await screen.findByRole('button', { name: 'Reply' });
    rerender(<Harness text="Passage" conversationId="two" />);
    expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
    select(screen.getByText('Passage'));
    await screen.findByRole('button', { name: 'Reply' });
    rerender(<Harness text="Changed passage" conversationId="two" />);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull(),
    );
  });

  it('keeps a newer drop when acknowledging a previously rendered batch', () => {
    const first = new File(['a'], 'a.txt');
    const second = new File(['b'], 'b.txt');
    const { result, rerender } = renderHook(
      ({ files }) =>
        useMessageSelectionReply({
          conversationId: 'one',
          enabled: true,
          droppedFiles: files,
          onDroppedFilesConsumed: consume,
        }),
      { initialProps: { files: [first] } },
    );
    const acknowledge = result.current.onFilesConsumed;
    rerender({ files: [second] });
    act(acknowledge);
    expect(result.current.pendingFiles).toEqual([second]);
  });
});

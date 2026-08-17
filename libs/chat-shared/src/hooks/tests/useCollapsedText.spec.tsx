import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCollapsedText } from '../useCollapsedText';

interface TestCollapsedTextProps {
  text: string;
  collapsedLineCount: number;
}

const TestCollapsedText = ({
  text,
  collapsedLineCount,
}: TestCollapsedTextProps) => {
  const {
    textRef,
    isTextCollapsed,
    isOverflowing,
    collapsedMaxHeight,
    expandedMaxHeight,
    isCollapsed,
    toggleCollapsed,
  } = useCollapsedText({ text, collapsedLineCount });

  return (
    <div>
      <p ref={textRef}>{text}</p>
      <output aria-label="Collapsed">{String(isCollapsed)}</output>
      <output aria-label="Text collapsed">{String(isTextCollapsed)}</output>
      <output aria-label="Overflowing">{String(isOverflowing)}</output>
      <output aria-label="Collapsed height">{collapsedMaxHeight}</output>
      <output aria-label="Expanded height">{expandedMaxHeight}</output>
      <button type="button" onClick={toggleCollapsed}>
        Toggle
      </button>
    </div>
  );
};

const mockParagraphScrollHeight = (scrollHeight: number) => {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
    function (this: HTMLElement) {
      return this.tagName === 'P' ? scrollHeight : 0;
    },
  );
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCollapsedText', () => {
  it('marks text as collapsed and overflowing when rendered text exceeds the collapsed height', async () => {
    mockParagraphScrollHeight(72);

    render(<TestCollapsedText text="Long text" collapsedLineCount={2} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Overflowing').textContent).toBe('true');
    });
    expect(screen.getByLabelText('Collapsed').textContent).toBe('true');
    expect(screen.getByLabelText('Text collapsed').textContent).toBe('true');
    expect(screen.getByLabelText('Collapsed height').textContent).toBe('48');
    expect(screen.getByLabelText('Expanded height').textContent).toBe('72');
  });

  it('toggles between expanded and collapsed states', async () => {
    mockParagraphScrollHeight(72);

    render(<TestCollapsedText text="Long text" collapsedLineCount={2} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Text collapsed').textContent).toBe('true');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

    expect(screen.getByLabelText('Collapsed').textContent).toBe('false');
    expect(screen.getByLabelText('Text collapsed').textContent).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

    expect(screen.getByLabelText('Collapsed').textContent).toBe('true');
    expect(screen.getByLabelText('Text collapsed').textContent).toBe('true');
  });

  it('does not mark short text as overflowing', async () => {
    mockParagraphScrollHeight(24);

    render(<TestCollapsedText text="Short text" collapsedLineCount={2} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Overflowing').textContent).toBe('false');
    });
    expect(screen.getByLabelText('Text collapsed').textContent).toBe('false');
  });

  it('resets to collapsed when the text changes', async () => {
    mockParagraphScrollHeight(72);

    const { rerender } = render(
      <TestCollapsedText text="Long text" collapsedLineCount={2} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Text collapsed').textContent).toBe('true');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

    expect(screen.getByLabelText('Collapsed').textContent).toBe('false');

    rerender(
      <TestCollapsedText text="Another long text" collapsedLineCount={2} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Collapsed').textContent).toBe('true');
    });
  });

  it('uses at least one collapsed line when collapsedLineCount is less than one', async () => {
    mockParagraphScrollHeight(72);

    render(<TestCollapsedText text="Long text" collapsedLineCount={0} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Overflowing').textContent).toBe('true');
    });
    expect(screen.getByLabelText('Collapsed height').textContent).toBe('24');
  });

  it('calculates correct collapsedMaxHeight for a larger collapsedLineCount', async () => {
    mockParagraphScrollHeight(24);

    render(<TestCollapsedText text="Text" collapsedLineCount={3} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Collapsed height').textContent).toBe('72');
    });
  });

  it('does not mark text as overflowing within the overflow tolerance', async () => {
    mockParagraphScrollHeight(49);

    render(<TestCollapsedText text="Text" collapsedLineCount={2} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Overflowing').textContent).toBe('false');
    });
    expect(screen.getByLabelText('Text collapsed').textContent).toBe('false');
  });

  it('marks text as overflowing when scrollHeight exceeds the overflow tolerance', async () => {
    mockParagraphScrollHeight(50);

    render(<TestCollapsedText text="Text" collapsedLineCount={2} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Overflowing').textContent).toBe('true');
    });
    expect(screen.getByLabelText('Text collapsed').textContent).toBe('true');
  });

  it('keeps isOverflowing true but isTextCollapsed false when expanded', async () => {
    mockParagraphScrollHeight(72);

    render(<TestCollapsedText text="Long text" collapsedLineCount={2} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Text collapsed').textContent).toBe('true');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

    expect(screen.getByLabelText('Overflowing').textContent).toBe('true');
    expect(screen.getByLabelText('Collapsed').textContent).toBe('false');
    expect(screen.getByLabelText('Text collapsed').textContent).toBe('false');
  });

  it('resets to collapsed when collapsedLineCount changes', async () => {
    mockParagraphScrollHeight(72);

    const { rerender } = render(
      <TestCollapsedText text="Long text" collapsedLineCount={2} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Text collapsed').textContent).toBe('true');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

    expect(screen.getByLabelText('Collapsed').textContent).toBe('false');

    rerender(<TestCollapsedText text="Long text" collapsedLineCount={1} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Collapsed').textContent).toBe('true');
    });
  });

  it('uses at least one collapsed line when collapsedLineCount is negative', async () => {
    mockParagraphScrollHeight(72);

    render(<TestCollapsedText text="Long text" collapsedLineCount={-5} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Overflowing').textContent).toBe('true');
    });
    expect(screen.getByLabelText('Collapsed height').textContent).toBe('24');
  });

  it('starts in the collapsed state initially', () => {
    mockParagraphScrollHeight(72);

    render(<TestCollapsedText text="Long text" collapsedLineCount={2} />);

    expect(screen.getByLabelText('Collapsed').textContent).toBe('true');
  });
});

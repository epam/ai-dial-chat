import { act, render, screen, waitFor } from '@testing-library/react';
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
    isCollapsed,
    toggleCollapsed,
  } = useCollapsedText({ text, collapsedLineCount });

  return (
    <div>
      <p ref={textRef}>{text}</p>
      <span data-testid="collapsed">{String(isCollapsed)}</span>
      <span data-testid="text-collapsed">{String(isTextCollapsed)}</span>
      <span data-testid="overflowing">{String(isOverflowing)}</span>
      <span data-testid="max-height">{collapsedMaxHeight}</span>
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
      expect(screen.getByTestId('overflowing').textContent).toBe('true');
    });
    expect(screen.getByTestId('collapsed').textContent).toBe('true');
    expect(screen.getByTestId('text-collapsed').textContent).toBe('true');
    expect(screen.getByTestId('max-height').textContent).toBe('48');
  });

  it('toggles between expanded and collapsed states', async () => {
    mockParagraphScrollHeight(72);

    render(<TestCollapsedText text="Long text" collapsedLineCount={2} />);

    await waitFor(() => {
      expect(screen.getByTestId('text-collapsed').textContent).toBe('true');
    });

    act(() => {
      screen.getByRole('button', { name: 'Toggle' }).click();
    });

    expect(screen.getByTestId('collapsed').textContent).toBe('false');
    expect(screen.getByTestId('text-collapsed').textContent).toBe('false');

    act(() => {
      screen.getByRole('button', { name: 'Toggle' }).click();
    });

    expect(screen.getByTestId('collapsed').textContent).toBe('true');
    expect(screen.getByTestId('text-collapsed').textContent).toBe('true');
  });

  it('does not mark short text as overflowing', async () => {
    mockParagraphScrollHeight(24);

    render(<TestCollapsedText text="Short text" collapsedLineCount={2} />);

    await waitFor(() => {
      expect(screen.getByTestId('overflowing').textContent).toBe('false');
    });
    expect(screen.getByTestId('text-collapsed').textContent).toBe('false');
  });

  it('resets to collapsed when the text changes', async () => {
    mockParagraphScrollHeight(72);

    const { rerender } = render(
      <TestCollapsedText text="Long text" collapsedLineCount={2} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('text-collapsed').textContent).toBe('true');
    });

    act(() => {
      screen.getByRole('button', { name: 'Toggle' }).click();
    });

    expect(screen.getByTestId('collapsed').textContent).toBe('false');

    rerender(
      <TestCollapsedText text="Another long text" collapsedLineCount={2} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('collapsed').textContent).toBe('true');
    });
  });

  it('uses at least one collapsed line when collapsedLineCount is less than one', async () => {
    mockParagraphScrollHeight(72);

    render(<TestCollapsedText text="Long text" collapsedLineCount={0} />);

    await waitFor(() => {
      expect(screen.getByTestId('overflowing').textContent).toBe('true');
    });
    expect(screen.getByTestId('max-height').textContent).toBe('24');
  });

  it('calculates correct collapsedMaxHeight for a larger collapsedLineCount', async () => {
    mockParagraphScrollHeight(24);

    render(<TestCollapsedText text="Text" collapsedLineCount={3} />);

    await waitFor(() => {
      expect(screen.getByTestId('max-height').textContent).toBe('72');
    });
  });

  it('does not mark text as overflowing within the overflow tolerance', async () => {
    mockParagraphScrollHeight(49);

    render(<TestCollapsedText text="Text" collapsedLineCount={2} />);

    await waitFor(() => {
      expect(screen.getByTestId('overflowing').textContent).toBe('false');
    });
    expect(screen.getByTestId('text-collapsed').textContent).toBe('false');
  });

  it('marks text as overflowing when scrollHeight exceeds the overflow tolerance', async () => {
    mockParagraphScrollHeight(50);

    render(<TestCollapsedText text="Text" collapsedLineCount={2} />);

    await waitFor(() => {
      expect(screen.getByTestId('overflowing').textContent).toBe('true');
    });
    expect(screen.getByTestId('text-collapsed').textContent).toBe('true');
  });

  it('keeps isOverflowing true but isTextCollapsed false when expanded', async () => {
    mockParagraphScrollHeight(72);

    render(<TestCollapsedText text="Long text" collapsedLineCount={2} />);

    await waitFor(() => {
      expect(screen.getByTestId('text-collapsed').textContent).toBe('true');
    });

    act(() => {
      screen.getByRole('button', { name: 'Toggle' }).click();
    });

    expect(screen.getByTestId('overflowing').textContent).toBe('true');
    expect(screen.getByTestId('collapsed').textContent).toBe('false');
    expect(screen.getByTestId('text-collapsed').textContent).toBe('false');
  });

  it('resets to collapsed when collapsedLineCount changes', async () => {
    mockParagraphScrollHeight(72);

    const { rerender } = render(
      <TestCollapsedText text="Long text" collapsedLineCount={2} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('text-collapsed').textContent).toBe('true');
    });

    act(() => {
      screen.getByRole('button', { name: 'Toggle' }).click();
    });

    expect(screen.getByTestId('collapsed').textContent).toBe('false');

    rerender(<TestCollapsedText text="Long text" collapsedLineCount={1} />);

    await waitFor(() => {
      expect(screen.getByTestId('collapsed').textContent).toBe('true');
    });
  });

  it('uses at least one collapsed line when collapsedLineCount is negative', async () => {
    mockParagraphScrollHeight(72);

    render(<TestCollapsedText text="Long text" collapsedLineCount={-5} />);

    await waitFor(() => {
      expect(screen.getByTestId('overflowing').textContent).toBe('true');
    });
    expect(screen.getByTestId('max-height').textContent).toBe('24');
  });

  it('starts in the collapsed state initially', () => {
    mockParagraphScrollHeight(72);

    render(<TestCollapsedText text="Long text" collapsedLineCount={2} />);

    expect(screen.getByTestId('collapsed').textContent).toBe('true');
  });
});

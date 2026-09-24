import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MARKDOWN_CLASS_NAMES } from '../markdown-class-names';
import { MDMessageViewer } from '../MDMessageViewer';
import { PlainTextRenderer } from '../PlainTextRenderer';

const TABLE_MARKDOWN = `| Item | Amount |
| --- | --- |
| Rent | 1,245.50 |
| **Total** | 12,400.00 |`;

/*
 * The body paragraph carries no role of its own, and the point of every
 * assertion here is that the text survived unparsed — which only an exact,
 * un-normalised `textContent` comparison can show, since Testing Library's
 * default normaliser collapses the newlines that are half the evidence.
 */
const getBody = (text: string) =>
  screen.getByText(
    (_, element) => element?.tagName === 'P' && element.textContent === text,
  );

describe('PlainTextRenderer', () => {
  it('renders a markdown table verbatim instead of parsing it', () => {
    render(<PlainTextRenderer content={TABLE_MARKDOWN} />);

    expect(screen.queryByRole('table')).toBeNull();
    expect(getBody(TABLE_MARKDOWN)).toBeTruthy();
  });

  it('renders headings, emphasis and links as literal text', () => {
    const content = '# Heading\n_em_ [link](https://a.example)';
    render(<PlainTextRenderer content={content} />);

    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(getBody(content)).toBeTruthy();
  });

  it('does not turn raw HTML in the message into elements', () => {
    const content = '<img src=x onerror="alert(1)">';
    render(<PlainTextRenderer content={content} />);

    expect(screen.queryByRole('img')).toBeNull();
    expect(getBody(content)).toBeTruthy();
  });

  it('preserves newlines and runs of whitespace', () => {
    const content = 'line one\n\n  indented';
    render(<PlainTextRenderer content={content} />);

    expect(getBody(content).className).toContain('whitespace-pre-wrap');
  });

  it('applies the caller paragraph typography class', () => {
    render(
      <PlainTextRenderer
        content="text"
        classNames={DEFAULT_MARKDOWN_CLASS_NAMES}
      />,
    );

    expect(getBody('text').className).toContain('dial-body-paragraph-text');
  });

  it('shows the thinking label while streaming with no content yet', () => {
    render(
      <PlainTextRenderer content="" isStreaming thinkingLabel="Thinking…" />,
    );

    expect(screen.getByText('Thinking…')).toBeTruthy();
  });
});

describe('MDMessageViewer — isPlainText', () => {
  it('parses markdown by default', () => {
    render(<MDMessageViewer content={TABLE_MARKDOWN} />);

    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('renders the body verbatim when isPlainText is set', () => {
    render(<MDMessageViewer content={TABLE_MARKDOWN} isPlainText />);

    expect(screen.queryByRole('table')).toBeNull();
    expect(getBody(TABLE_MARKDOWN)).toBeTruthy();
  });
});

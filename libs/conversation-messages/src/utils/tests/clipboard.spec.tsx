import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { copySelectionWithoutStyles } from '../clipboard';

const createClipboardData = () => {
  const data = new Map<string, string>();

  return {
    data,
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? '',
  };
};

const selectContents = (node: Node) => {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

const renderCopyTarget = () => {
  render(
    <div
      role="group"
      aria-label="Message"
      className="bg-layer-2"
      style={{ background: 'rgb(238, 241, 247)' }}
      onCopy={copySelectionWithoutStyles}
    >
      <div className="text-primary" style={{ color: 'rgb(22, 27, 45)' }}>
        <p className="leading-6" style={{ backgroundColor: 'yellow' }}>
          Hello <strong className="font-semibold">world</strong>
        </p>
        <pre>
          <code className="hljs">{'line 1\nline 2'}</code>
        </pre>
        <a href="https://example.com" className="underline">
          link
        </a>
      </div>
    </div>,
  );
};

const getGroup = () => screen.getByRole('group', { name: 'Message' });

describe('copySelectionWithoutStyles', () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges();
  });

  it('writes html without classes or inline colors, keeping structure', () => {
    renderCopyTarget();
    const group = getGroup();
    selectContents(group);
    const clipboardData = createClipboardData();

    const isNotPrevented = fireEvent.copy(group, { clipboardData });

    const html = clipboardData.data.get('text/html') ?? '';
    expect(isNotPrevented).toBe(false);
    expect(html).not.toContain('class=');
    expect(html).not.toContain('background');
    expect(html).not.toContain('color');
    expect(html).toContain('<strong>world</strong>');
    expect(html).toContain('<a href="https://example.com">link</a>');
    expect(html).toContain('white-space: pre-wrap');
    expect(clipboardData.data.get('text/plain')).toContain('Hello world');
  });

  it('keeps the enclosing block of a selection inside a code block', () => {
    renderCopyTarget();
    const group = getGroup();
    selectContents(screen.getByText(/line 1/));
    const clipboardData = createClipboardData();

    fireEvent.copy(group, { clipboardData });

    const html = clipboardData.data.get('text/html') ?? '';
    expect(html).toMatch(/^<div><pre[^>]*><code[^>]*>line 1\nline 2<\/code>/);
  });

  it('leaves the default copy alone when nothing is selected', () => {
    renderCopyTarget();
    const group = getGroup();
    const clipboardData = createClipboardData();

    const isNotPrevented = fireEvent.copy(group, { clipboardData });

    expect(isNotPrevented).toBe(true);
    expect(clipboardData.data.size).toBe(0);
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StageCodeBlock } from '../StageCodeBlock';

vi.mock('@epam/ai-dial-chat-shared', () => ({
  MarkdownCodeBlock: ({
    language,
    value,
    copyLabel,
    hideDownload,
  }: {
    language: string;
    value: string;
    copyLabel: string;
    hideDownload: boolean;
  }) => (
    <section aria-label={`Code block: ${language}`}>
      <span>{language}</span>
      <code>{value}</code>
      <button aria-label={copyLabel}>Copy</button>
      {hideDownload ? null : <button>Download</button>}
    </section>
  ),
  mergeClasses: (...args: (string | undefined | false | null)[]) =>
    args.filter(Boolean).join(' '),
}));

describe('StageCodeBlock', () => {
  it('renders code through the shared markdown code block', () => {
    render(
      <StageCodeBlock copyAriaLabel="Copy code" codeClassName="language-json">
        {'{"status":"ok"}'}
      </StageCodeBlock>,
    );

    expect(
      screen.getByRole('region', { name: 'Code block: json' }),
    ).toBeTruthy();
    expect(screen.getByText('{"status":"ok"}')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeTruthy();
  });

  it('does not render a download action for stage code', () => {
    render(
      <StageCodeBlock copyAriaLabel="Copy code">
        {'const x = 1;'}
      </StageCodeBlock>,
    );

    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
  });
});

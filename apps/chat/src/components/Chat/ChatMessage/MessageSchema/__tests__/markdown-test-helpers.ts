import { expect } from 'vitest';

import { screen } from '@testing-library/react';

export const BOLD_MARKDOWN_SAMPLE = '**bolded text** not bolded text';

export interface MarkdownHtmlExpectation {
  boldText: string;
  plainText: string;
  /** Full markdown source; built from bold/plain when omitted. */
  rawMarkdown?: string;
}

/**
 * Asserts markdown was parsed into real DOM HTML — not shown as raw `**` syntax,
 * not shown as escaped tags (`&lt;strong&gt;`), and not shown as literal tag text (`<strong>`).
 */
export const expectMarkdownRenderedAsHtml = ({
  boldText,
  plainText,
  rawMarkdown,
}: MarkdownHtmlExpectation) => {
  const markdown = rawMarkdown ?? `**${boldText}** ${plainText}`;

  expect(
    screen.getByText(boldText, { selector: 'strong' }),
    `expected <strong>${boldText}</strong> in the DOM`,
  ).toBeInTheDocument();

  expect(screen.getByText(plainText)).toBeInTheDocument();
  expect(
    screen.queryByText(markdown, { exact: false }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  expect(screen.queryByText('<strong>')).not.toBeInTheDocument();
  expect(screen.queryByText('</strong>')).not.toBeInTheDocument();
  expect(screen.queryByText('&lt;')).not.toBeInTheDocument();
  expect(screen.queryByText('&gt;')).not.toBeInTheDocument();
};

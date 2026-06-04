import { expect } from 'vitest';

import { screen, within } from '@testing-library/react';

export const BOLD_MARKDOWN_SAMPLE = '**bolded text** not bolded text';

export interface MarkdownHtmlExpectation {
  boldText: string;
  plainText: string;
  /** Full markdown source; built from bold/plain when omitted. */
  rawMarkdown?: string;
}

/** Returns the paragraph (or parent) wrapping parsed markdown for the given bold segment. */
export const getMarkdownBlockRoot = (boldText: string): HTMLElement => {
  const strong = screen.getByText(boldText, { selector: 'strong' });

  return (strong.closest('p') ?? strong.parentElement ?? strong) as HTMLElement;
};

/**
 * Asserts markdown was parsed into real DOM HTML — not shown as raw `**` syntax,
 * not shown as escaped tags (`&lt;strong&gt;`), and not shown as literal tag text (`<strong>`).
 */
export const expectMarkdownRenderedAsHtml = (
  root: HTMLElement,
  { boldText, plainText, rawMarkdown }: MarkdownHtmlExpectation,
) => {
  const markdown = rawMarkdown ?? `**${boldText}** ${plainText}`;

  const strongElements = root.querySelectorAll('strong');
  const strong = Array.from(strongElements).find(
    (element) => element.textContent === boldText,
  );

  expect(
    strong,
    `expected <strong>${boldText}</strong> in the DOM`,
  ).toBeDefined();

  const block = strong!.closest('p') ?? strong!.parentElement ?? root;

  // Real HTML nodes exist (parser output is elements, not a string of tags).
  expect(root.innerHTML.toLowerCase()).toContain('<strong');
  expect(strong!.tagName).toBe('STRONG');

  // Visible text must not contain unparsed markdown or HTML-encoded / literal tags.
  expect(block.textContent).not.toContain('**');
  expect(block.textContent).not.toContain(markdown);
  expect(block.textContent).not.toContain('<strong>');
  expect(block.textContent).not.toContain('</strong>');
  expect(block.textContent).not.toContain('&lt;');
  expect(block.textContent).not.toContain('&gt;');

  // Plain segment is present as text outside <strong>.
  const plainElement = within(block as HTMLElement).getByText(
    (_content, element) =>
      element?.textContent?.includes(plainText) === true &&
      element.closest('strong') === null,
  );

  expect(plainElement).toBeInTheDocument();
};

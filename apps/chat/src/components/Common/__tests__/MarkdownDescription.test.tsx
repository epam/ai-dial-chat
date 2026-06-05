import { describe, expect, it } from 'vitest';

import { render } from '@testing-library/react';

import {
  BOLD_MARKDOWN_SAMPLE,
  expectMarkdownRenderedAsHtml,
} from '@/src/components/Chat/ChatMessage/MessageSchema/__tests__/markdown-test-helpers';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';

describe('EntityMarkdownDescription', () => {
  it('renders markdown as HTML elements, not as raw or encoded markup', () => {
    render(
      <EntityMarkdownDescription className="text-base text-primary">
        {BOLD_MARKDOWN_SAMPLE}
      </EntityMarkdownDescription>,
    );

    expectMarkdownRenderedAsHtml({
      boldText: 'bolded text',
      plainText: 'not bolded text',
      rawMarkdown: BOLD_MARKDOWN_SAMPLE,
    });
  });

  it('does not treat unparsed markdown source as acceptable output', () => {
    render(
      <div className="text-base text-primary">{BOLD_MARKDOWN_SAMPLE}</div>,
    );

    expect(() =>
      expectMarkdownRenderedAsHtml({
        boldText: 'bolded text',
        plainText: 'not bolded text',
        rawMarkdown: BOLD_MARKDOWN_SAMPLE,
      }),
    ).toThrow();
  });
});

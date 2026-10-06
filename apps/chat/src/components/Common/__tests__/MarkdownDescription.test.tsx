import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import {
  BOLD_MARKDOWN_SAMPLE,
  expectMarkdownRenderedAsHtml,
} from '@/src/components/Chat/ChatMessage/MessageSchema/__tests__/markdown-test-helpers';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';

vi.mock('@/src/store/hooks', () => ({
  useAppSelector: vi.fn((selector) => selector()),
}));

vi.mock('@/src/store/selectors', () => ({
  SettingsSelectors: {
    selectAllowedImageSources: vi.fn(() => ''),
  },
}));

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

  describe('isInlinePreview', () => {
    const FORMATTED_DESCRIPTION = [
      '<h1>This is heading 1</h1>',
      '<p>This is some text.</p>',
      '<hr>',
    ].join('\n');

    it('renders formatting as block elements by default', () => {
      render(
        <EntityMarkdownDescription>
          {FORMATTED_DESCRIPTION}
        </EntityMarkdownDescription>,
      );

      expect(
        screen.getByRole('heading', { name: 'This is heading 1' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('separator')).toBeInTheDocument();
    });

    it('renders headings as plain text and drops separators', () => {
      render(
        <EntityMarkdownDescription isInlinePreview>
          {FORMATTED_DESCRIPTION}
        </EntityMarkdownDescription>,
      );

      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
      expect(screen.getByText('This is heading 1')).toBeInTheDocument();
    });

    it('keeps paragraphs as inline <p> elements', () => {
      render(
        <EntityMarkdownDescription isInlinePreview>
          {FORMATTED_DESCRIPTION}
        </EntityMarkdownDescription>,
      );

      expect(
        screen.getByText('This is some text.', { selector: 'p' }),
      ).toHaveClass('inline');
    });

    it('keeps words from adjacent blocks separated', () => {
      render(
        <EntityMarkdownDescription isInlinePreview>
          {'<h1>This is heading 1</h1><p>This is some text.</p>'}
        </EntityMarkdownDescription>,
      );

      expect(document.body).toHaveTextContent(
        'This is heading 1 This is some text.',
      );
    });

    it('keeps inline emphasis', () => {
      render(
        <EntityMarkdownDescription isInlinePreview>
          {BOLD_MARKDOWN_SAMPLE}
        </EntityMarkdownDescription>,
      );

      expect(
        screen.getByText('bolded text', { selector: 'strong' }),
      ).toBeInTheDocument();
    });
  });
});

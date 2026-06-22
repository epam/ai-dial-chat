import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import React from 'react';
import { Provider } from 'react-redux';

import { configureStore } from '@reduxjs/toolkit';

import { ChatMDComponent } from '../ChatMDComponent';

// Mock the SVG import
vi.mock('@/public/images/icons/chevron-down.svg', () => ({
  default: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="chevron-down-icon" {...props}>
      <path d="M6 9L12 15L18 9" />
    </svg>
  ),
}));

global.ResizeObserver = class ResizeObserver {
  observe() {
    console.info(
      'ResizeObserver.observe() is not implemented in this test environment.',
    );
  }

  unobserve() {
    console.info(
      'ResizeObserver.unobserve() is not implemented in this test environment.',
    );
  }

  disconnect() {
    console.info(
      'ResizeObserver.disconnect() is not implemented in this test environment.',
    );
  }
};

// Mock store setup
const mockStore = configureStore({
  reducer: {
    ui: () => ({
      isChatFullWidth: false,
    }),
    settings: () => ({
      isOverlay: false,
      enabledFeatures: [],
      enabledFeaturesData: {},
    }),
  },
});

const renderWithStore = (component: React.ReactElement) => {
  return render(<Provider store={mockStore}>{component}</Provider>);
};

// Helper to trim indentation from template literals
const trimIndent = (str: string): string => {
  const lines = str.split('\n');
  // Remove first and last line if empty
  if (lines[0].trim() === '') lines.shift();
  if (lines[lines.length - 1].trim() === '') lines.pop();

  // Find minimum indentation
  const minIndent = lines
    .filter((line) => line.trim().length > 0)
    .reduce((min, line) => {
      const indent = line.match(/^\s*/)?.[0].length || 0;
      return Math.min(min, indent);
    }, Infinity);

  // Remove minimum indentation from all lines
  return lines.map((line) => line.slice(minIndent)).join('\n');
};

describe('ChatMDComponent', () => {
  describe('basic rendering', () => {
    it('renders plain text content', () => {
      renderWithStore(
        <ChatMDComponent
          isShowResponseLoader={false}
          content="Hello, World!"
        />,
      );

      expect(screen.getByText('Hello, World!')).toBeInTheDocument();
    });

    it('renders markdown formatted text', () => {
      renderWithStore(
        <ChatMDComponent
          isShowResponseLoader={false}
          content="**bold text** and *italic text*"
        />,
      );

      const boldElement = screen.getByText('bold text');
      const italicElement = screen.getByText('italic text');

      expect(boldElement).toBeInTheDocument();
      expect(boldElement.tagName).toBe('STRONG');
      expect(italicElement).toBeInTheDocument();
      expect(italicElement.tagName).toBe('EM');
    });
  });

  describe('collapsible sections', () => {
    it('renders details element with summary', () => {
      const content = trimIndent(`
        <details>
          <summary>Click to expand</summary>

          Content here

        </details>
      `);

      renderWithStore(
        <ChatMDComponent isShowResponseLoader={false} content={content} />,
      );

      // details element has role 'group'
      const detailsElement = screen.getByRole('group');
      expect(detailsElement).toBeInTheDocument();
      expect(screen.getByText('Click to expand')).toBeInTheDocument();
      expect(screen.getByText('Content here')).toBeInTheDocument();
    });

    it('renders details with styling', () => {
      const content = trimIndent(`
        <details>
          <summary>Test Summary</summary>

          Test Content

        </details>
      `);

      renderWithStore(
        <ChatMDComponent isShowResponseLoader={false} content={content} />,
      );

      const detailsElement = screen.getByRole('group');
      expect(detailsElement).toBeInTheDocument();
      expect(detailsElement).toHaveAttribute('class');
    });

    it('renders summary with styling', () => {
      const content = trimIndent(`
        <details>
          <summary>Test Summary</summary>

          Test Content

        </details>
      `);

      renderWithStore(
        <ChatMDComponent isShowResponseLoader={false} content={content} />,
      );

      const summaryElement = screen.getByText('Test Summary');
      expect(summaryElement).toBeInTheDocument();
      expect(summaryElement).toHaveAttribute('class');
    });

    it('renders markdown content inside details', () => {
      const content = trimIndent(`
        <details>
          <summary>Markdown Example</summary>

          **Bold text** inside details

          - List item 1
          - List item 2

        </details>
      `);

      renderWithStore(
        <ChatMDComponent isShowResponseLoader={false} content={content} />,
      );

      expect(screen.getByText('Markdown Example')).toBeInTheDocument();
      expect(screen.getByText('Bold text')).toBeInTheDocument();
      expect(screen.getByText('List item 1')).toBeInTheDocument();
      expect(screen.getByText('List item 2')).toBeInTheDocument();
    });

    it('renders multiple collapsible sections', () => {
      const content = trimIndent(`
        <details>
          <summary>Section 1</summary>

          Content 1

        </details>

        <details>
          <summary>Section 2</summary>

          Content 2

        </details>
      `);

      renderWithStore(
        <ChatMDComponent isShowResponseLoader={false} content={content} />,
      );

      expect(screen.getByText('Section 1')).toBeInTheDocument();
      expect(screen.getByText('Section 2')).toBeInTheDocument();
      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });

    it('renders nested markdown elements in details', () => {
      const content = trimIndent(`
        <details>
          <summary>Markdown Example</summary>

          **Bold text** in details

        </details>
      `);

      renderWithStore(
        <ChatMDComponent isShowResponseLoader={false} content={content} />,
      );

      expect(screen.getByText('Markdown Example')).toBeInTheDocument();
      const boldElement = screen.getByText('Bold text');
      expect(boldElement).toBeInTheDocument();
      expect(boldElement.tagName).toBe('STRONG');
    });

    it('handles details with open attribute', () => {
      const content = trimIndent(`
        <details open>
          <summary>Default Open</summary>

          This is visible by default

        </details>
      `);

      renderWithStore(
        <ChatMDComponent isShowResponseLoader={false} content={content} />,
      );

      const detailsElement = screen.getByRole('group');
      expect(detailsElement).toHaveAttribute('open');
      expect(screen.getByText('Default Open')).toBeInTheDocument();
      expect(
        screen.getByText('This is visible by default'),
      ).toBeInTheDocument();
    });
  });

  describe('security', () => {
    it('sanitizes dangerous HTML while keeping details/summary', () => {
      const content = trimIndent(`
        <details>
          <summary>Safe Content</summary>

          <script id="unsafe-script">alert('xss')</script>
          **Safe markdown**

        </details>
      `);

      renderWithStore(
        <ChatMDComponent isShowResponseLoader={false} content={content} />,
      );

      expect(screen.getByText('Safe Content')).toBeInTheDocument();
      expect(screen.getByText('Safe markdown')).toBeInTheDocument();
      // Script tag should be sanitized out
      expect(screen.queryByText(/alert/)).not.toBeInTheDocument();
      expect(screen.queryByRole('script')).not.toBeInTheDocument();
    });
  });

  describe('response loader', () => {
    it('shows response loader cursor when isShowResponseLoader is true', () => {
      renderWithStore(
        <ChatMDComponent isShowResponseLoader content="Loading..." />,
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CitationsI18nKeys } from '../../../../constants/translation-keys';
import type { AnnotationGroup } from '../../../../utils/group-annotations-by-source';
import CitationPopup from '../CitationPopup';

// react-i18next is globally mocked — t(key) returns the key string.

const makeGroup = (
  count = 1,
  attachmentType = 'application/pdf',
): AnnotationGroup => ({
  sourceUrl: 'https://files.example.com/report.pdf',
  sourceName: 'report.pdf',
  annotations: Array.from({ length: count }, (_, i) => ({
    index: i,
    body: {
      title: `Title ${i}`,
      quote: `Quote ${i}`,
      source: {
        type: 'attachment' as const,
        attachment: {
          type: attachmentType,
          url: 'https://files.example.com/report.pdf',
        },
      },
    },
  })),
  get primaryAnnotation() {
    return this.annotations[0];
  },
});

const defaultProps = (
  overrides: Partial<Parameters<typeof CitationPopup>[0]> = {},
) => ({
  group: makeGroup(),
  activeIndex: 0,
  onIndexChange: vi.fn(),
  onPreview: vi.fn(),
  onOpenInBrowser: vi.fn(),
  ...overrides,
});

describe('CitationPopup', () => {
  it('renders with role="dialog"', () => {
    render(<CitationPopup {...defaultProps()} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('hides the switcher when there is only one annotation', () => {
    render(<CitationPopup {...defaultProps({ group: makeGroup(1) })} />);
    expect(screen.queryByText(CitationsI18nKeys.PopupSwitcher)).toBeFalsy();
  });

  it('shows the switcher when there are multiple annotations', () => {
    render(
      <CitationPopup
        {...defaultProps({ group: makeGroup(3), activeIndex: 0 })}
      />,
    );
    expect(screen.getByText(CitationsI18nKeys.PopupSwitcher)).toBeTruthy();
  });

  it('calls onIndexChange with incremented index when next is clicked', async () => {
    const onIndexChange = vi.fn();
    render(
      <CitationPopup
        {...defaultProps({
          group: makeGroup(3),
          activeIndex: 0,
          onIndexChange,
        })}
      />,
    );
    const nextBtn = screen.getByRole('button', {
      name: CitationsI18nKeys.PopupNextCitation,
    });
    await userEvent.click(nextBtn);
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it('previous button is disabled when activeIndex is 0', () => {
    render(
      <CitationPopup
        {...defaultProps({ group: makeGroup(3), activeIndex: 0 })}
      />,
    );
    const prevBtn = screen.getByRole('button', {
      name: CitationsI18nKeys.PopupPreviousCitation,
    });
    expect(prevBtn.getAttribute('disabled')).toBeDefined();
  });

  it('renders body title and quote for the active annotation', () => {
    const group = makeGroup(1);
    render(<CitationPopup {...defaultProps({ group })} />);
    expect(screen.getByText('Title 0')).toBeTruthy();
    expect(screen.getByText('Quote 0')).toBeTruthy();
  });

  it('"Preview" button calls onPreview with the active annotation', async () => {
    const onPreview = vi.fn();
    const group = makeGroup(1);
    render(<CitationPopup {...defaultProps({ group, onPreview })} />);
    await userEvent.click(
      screen.getByRole('button', { name: CitationsI18nKeys.PopupPreview }),
    );
    expect(onPreview).toHaveBeenCalledWith(group.annotations[0]);
  });

  it('"Open in browser" button calls onOpenInBrowser with the active annotation', async () => {
    const onOpenInBrowser = vi.fn();
    const group = makeGroup(1, 'text/html');
    render(<CitationPopup {...defaultProps({ group, onOpenInBrowser })} />);
    await userEvent.click(
      screen.getByRole('button', {
        name: CitationsI18nKeys.PopupOpenInBrowser,
      }),
    );
    expect(onOpenInBrowser).toHaveBeenCalledWith(group.annotations[0]);
  });
});

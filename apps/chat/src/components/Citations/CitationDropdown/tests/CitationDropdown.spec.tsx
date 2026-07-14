import type { Annotation } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BasicI18nKeys } from '../../../../constants/translation-keys';
import { CitationCardProvider } from '../../../../context/CitationCardContext';
import { useCitationCard } from '../../../../hooks/citations/useCitationCard';
import type { AnnotationGroup } from '../../../../utils/group-annotations-by-source';
import CitationDropdown from '../CitationDropdown';

// react-i18next is globally mocked — t(key) returns the key string.

const makeGroup = (): AnnotationGroup => {
  const annotation: Annotation = {
    body: {
      title: 'livescience.com',
      quote: 'Dinosaurs first appeared in the Triassic',
      source: {
        type: 'attachment',
        attachment: { type: 'text/markdown', url: 'https://example.com/a' },
      },
    },
  };
  return {
    sourceUrl: 'https://example.com/a',
    sourceName: 'livescience.com',
    annotations: [annotation],
    primaryAnnotation: annotation,
  };
};

const Wrapper = (props: {
  group: AnnotationGroup;
  onPreview?: (annotation: Annotation) => void;
  onOpenInBrowser: (annotation: Annotation) => void;
}) => {
  const citationCard = useCitationCard();
  return (
    <CitationCardProvider value={citationCard}>
      <CitationDropdown {...props} />
    </CitationCardProvider>
  );
};

describe('CitationDropdown', () => {
  it('opens the popup with a Preview button when onPreview is provided', async () => {
    render(
      <Wrapper
        group={makeGroup()}
        onPreview={vi.fn()}
        onOpenInBrowser={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(
      screen.getByRole('button', { name: BasicI18nKeys.Preview }),
    ).toBeTruthy();
  });

  it('opens the popup without a Preview button when onPreview is omitted', async () => {
    render(<Wrapper group={makeGroup()} onOpenInBrowser={vi.fn()} />);
    await userEvent.click(screen.getByRole('button'));
    expect(
      screen.queryByRole('button', { name: BasicI18nKeys.Preview }),
    ).toBeFalsy();
  });
});

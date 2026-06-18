import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CitationsI18nKeys } from '../../../../constants/translation-keys';
import CitationMarker from '../CitationMarker';

// react-i18next is globally mocked in test-setup.ts; t(key) returns the key string.

const renderMarker = (
  props: Partial<Parameters<typeof CitationMarker>[0]> = {},
) =>
  render(
    <CitationMarker
      sourceName="Wikipedia"
      annotationCount={1}
      onOpen={vi.fn()}
      {...props}
    />,
  );

describe('CitationMarker', () => {
  it('uses the single-source label key when annotationCount is 1', () => {
    renderMarker({ annotationCount: 1 });
    // t() returns the i18n key in tests
    expect(screen.getByText(CitationsI18nKeys.MarkerLabel)).toBeTruthy();
  });

  it('uses the overflow label key when annotationCount > 1', () => {
    renderMarker({ annotationCount: 3 });
    expect(
      screen.getByText(CitationsI18nKeys.MarkerLabelWithOverflow),
    ).toBeTruthy();
  });

  it('calls onOpen when clicked', async () => {
    const onOpen = vi.fn();
    renderMarker({ onOpen });
    await userEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});

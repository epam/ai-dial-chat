import { renderHook } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import {
  CustomAppI18nKeys,
  EditorI18nKeys,
} from '../../../constants/translation-keys';
import { useMetadataLabels } from '../useMetadataLabels';

const getCustomAppOverrides = (t: TFunction) => ({
  name: {
    label: t(EditorI18nKeys.NameLabel),
    placeholder: t(CustomAppI18nKeys.NamePlaceholder),
  },
});

describe('useMetadataLabels', () => {
  it('builds every Metadata field label from the shared editor keys', () => {
    const { result } = renderHook(() => useMetadataLabels());

    expect(result.current.name.label).toBe(EditorI18nKeys.NameLabel);
    expect(result.current.iconUrl.addAvatarLabel).toBe(
      EditorI18nKeys.AddAvatarButtonLabel,
    );
    expect(result.current.version.placeholder).toBe(
      EditorI18nKeys.VersionPlaceholder,
    );
    expect(result.current.topics.placeholder).toBe(
      EditorI18nKeys.TopicsPlaceholder,
    );
  });

  it('applies a kind’s overrides on top of the shared labels', () => {
    const { result } = renderHook(() =>
      useMetadataLabels(getCustomAppOverrides),
    );

    expect(result.current.name.placeholder).toBe(
      CustomAppI18nKeys.NamePlaceholder,
    );
    expect(result.current.version.label).toBe(EditorI18nKeys.VersionLabel);
  });

  it('returns the same object across re-renders', () => {
    const { result, rerender } = renderHook(() =>
      useMetadataLabels(getCustomAppOverrides),
    );
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});

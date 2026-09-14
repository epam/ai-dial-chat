import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { SendOnEnter } from '@epam/ai-dial-conversation-input';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as useUiFeatureModule from '../../useUiFeature';
import { useNavigationMenuGroups } from '../useNavigationMenuGroups';

vi.mock('../../useUiFeature');

vi.mock('../../keyboard-shortcut/useKeyboardShortcutPreference', () => ({
  metaKey: 'Ctrl',
  useKeyboardShortcutPreference: () => ({
    preference: SendOnEnter.Enter,
    setPreference: vi.fn(),
  }),
}));

const languageMock = vi.hoisted(() => ({
  supported: [{ code: 'en', nativeName: 'English' }],
}));

vi.mock('../../language/useLanguage', () => ({
  get SUPPORTED_LANGUAGES() {
    return languageMock.supported;
  },
  useLanguage: () => ({ language: 'en', changeLanguage: vi.fn() }),
}));

describe('useNavigationMenuGroups', () => {
  const mockUseUiFeature = vi.mocked(useUiFeatureModule.useUiFeature);

  const mockUiFeatures = (hidden: Partial<Record<OverlayFeature, boolean>>) => {
    mockUseUiFeature.mockImplementation(
      (feature: OverlayFeature) => hidden[feature] ?? false,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUiFeatures({});
    languageMock.supported = [{ code: 'en', nativeName: 'English' }];
  });

  it('offers the keyboard-shortcut group with both options', () => {
    const { result } = renderHook(() => useNavigationMenuGroups());

    expect(result.current.keyboardGroup?.options).toHaveLength(2);
  });

  it('omits the group when user settings are hidden', () => {
    mockUiFeatures({ [OverlayFeature.HideUserSettings]: true });

    const { result } = renderHook(() => useNavigationMenuGroups());

    expect(result.current.keyboardGroup).toBeUndefined();
  });

  it('omits the group when keyboard shortcuts are hidden', () => {
    mockUiFeatures({ [OverlayFeature.HideKeyboardShortcuts]: true });

    const { result } = renderHook(() => useNavigationMenuGroups());

    expect(result.current.keyboardGroup).toBeUndefined();
  });

  /*
   * SUPPORTED_LANGUAGES ships a single entry, so no build currently renders a
   * language group — but it stays wired for the second locale.
   */
  it('omits the language group while only one locale ships', () => {
    const { result } = renderHook(() => useNavigationMenuGroups());

    expect(result.current.languageGroup).toBeUndefined();
  });

  it('offers a language group once a second locale is registered', () => {
    languageMock.supported = [
      { code: 'en', nativeName: 'English' },
      { code: 'ar', nativeName: 'العربية' },
    ];

    const { result } = renderHook(() => useNavigationMenuGroups());

    expect(result.current.languageGroup?.options).toHaveLength(2);
  });

  it('omits the language group when user settings are hidden', () => {
    languageMock.supported = [
      { code: 'en', nativeName: 'English' },
      { code: 'ar', nativeName: 'العربية' },
    ];
    mockUiFeatures({ [OverlayFeature.HideUserSettings]: true });

    const { result } = renderHook(() => useNavigationMenuGroups());

    expect(result.current.languageGroup).toBeUndefined();
  });

  it('keeps the language group when only keyboard shortcuts are hidden', () => {
    languageMock.supported = [
      { code: 'en', nativeName: 'English' },
      { code: 'ar', nativeName: 'العربية' },
    ];
    mockUiFeatures({ [OverlayFeature.HideKeyboardShortcuts]: true });

    const { result } = renderHook(() => useNavigationMenuGroups());

    expect(result.current.languageGroup).toBeDefined();
    expect(result.current.keyboardGroup).toBeUndefined();
  });

  /* Theme and "Default agent for new chats" live only in the Preferences tab. */
  it('builds no theme group under any configuration', () => {
    const { result } = renderHook(() => useNavigationMenuGroups());

    expect(Object.keys(result.current)).toEqual([
      'languageGroup',
      'keyboardGroup',
    ]);
  });
});

import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { SendOnEnter } from '@epam/ai-dial-conversation-input';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BasicI18nKeys,
  SettingsI18nKeys,
} from '../../../../constants/translation-keys';
import * as keyboardShortcutModule from '../../../../hooks/keyboard-shortcut/useKeyboardShortcutPreference';
import * as useUiFeatureModule from '../../../../hooks/useUiFeature';
import { UserConfigStatus } from '../../../../types/user-config-status';
import PreferencesTab from '../PreferencesTab';

vi.mock('../../../../hooks/useUiFeature');

/*
 * DefaultAgentSelect is covered by its own spec; here it is stubbed so these
 * tests stay about which rows the tab decides to render.
 */
vi.mock(
  '../../../../components/Settings/DefaultAgentSelect/DefaultAgentSelect',
  () => ({
    default: () => <div>default-agent-row</div>,
  }),
);

const deploymentsMock = vi.hoisted(() => ({
  items: [{ id: 'gpt-4o' }] as { id: string }[],
  isLoading: false,
}));

vi.mock('../../../../context/DeploymentsContext', () => ({
  useDeployments: () => deploymentsMock,
}));

/*
 * The default-agent row is offered only where the operator pinned an agent, so
 * this flag decides whether it renders at all. `appConfigStatus` additionally
 * gates the whole row set, because `useFeatureFlag` reports `false` until the
 * config is Ready and the tab must not render a row set it will revise.
 */
/*
 * `status` is seeded with the literal rather than `UserConfigStatus.Ready`:
 * vi.hoisted runs before imports, so the enum is not initialised yet here.
 * Every later assignment uses the enum.
 */
const appConfigMock = vi.hoisted(() => ({
  defaultDeploymentPinned: true,
  status: 'ready' as string,
}));

vi.mock('../../../../context/AppConfigContext', () => ({
  useAppConfig: () => ({ status: appConfigMock.status }),
  useFeatureFlag: (key: string) =>
    key === 'defaultDeploymentPinned'
      ? appConfigMock.defaultDeploymentPinned
      : false,
}));

/*
 * SUPPORTED_LANGUAGES ships a single entry, so the language row is unreachable
 * in a default build. This mock is what makes the multi-locale behaviour
 * testable at all — the tests must not assert against the shipping data.
 */
const languageMock = vi.hoisted(() => ({
  supported: [{ code: 'en', nativeName: 'English' }],
  language: 'en',
  changeLanguage: vi.fn(),
}));

vi.mock('../../../../hooks/language/useLanguage', () => ({
  get SUPPORTED_LANGUAGES() {
    return languageMock.supported;
  },
  useLanguage: () => ({
    language: languageMock.language,
    changeLanguage: languageMock.changeLanguage,
  }),
}));
vi.mock(
  '../../../../hooks/keyboard-shortcut/useKeyboardShortcutPreference',
  () => ({
    metaKey: 'Ctrl',
    useKeyboardShortcutPreference: vi.fn(),
  }),
);

/*
 * The global test-setup mock returns the bare key and drops interpolation
 * params, which would make the modifier assertion below vacuous. Interpolate
 * here so the test actually proves the modifier reaches the label.
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params?.modifier ? `${key}:${params.modifier}` : key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

/*
 * The real Select renders its options into a floating overlay that only opens on
 * interaction. Stubbing it to a native <select> keeps these tests about the tab's
 * own wiring — which rows exist, what they are labeled, what they write — rather
 * than about the kit's popup mechanics, which the kit tests already cover.
 */
vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const real = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...real,
    Select: ({
      options,
      value,
      labelProps,
      onChange,
    }: {
      options: { value: string; label: string }[];
      value: string;
      labelProps?: { label: string };
      onChange: (v: string) => void;
    }) => (
      <select
        value={value}
        aria-label={labelProps?.label}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    ),
  };
});

describe('PreferencesTab', () => {
  const mockUseUiFeature = vi.mocked(useUiFeatureModule.useUiFeature);
  const setKeyboardPreference = vi.fn();

  const mockUiFeatures = (hidden: Partial<Record<OverlayFeature, boolean>>) => {
    mockUseUiFeature.mockImplementation(
      (feature: OverlayFeature) => hidden[feature] ?? false,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUiFeatures({});
    deploymentsMock.items = [{ id: 'gpt-4o' }];
    appConfigMock.defaultDeploymentPinned = true;
    appConfigMock.status = UserConfigStatus.Ready;
    deploymentsMock.isLoading = false;
    languageMock.supported = [{ code: 'en', nativeName: 'English' }];
    languageMock.language = 'en';
    vi.mocked(
      keyboardShortcutModule.useKeyboardShortcutPreference,
    ).mockReturnValue({
      preference: SendOnEnter.Enter,
      setPreference: setKeyboardPreference,
    });
  });

  it('renders its heading and description', () => {
    render(<PreferencesTab />);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toBe(SettingsI18nKeys.Preferences);
    expect(
      screen.getByText(SettingsI18nKeys.PreferencesDescription),
    ).toBeTruthy();
  });

  /*
   * Row visibility depends on the client config and the deployment catalog, both
   * of which arrive over the network. Rendering rows before they settle made the
   * default-agent row pop in late next to an instantly-available keyboard row.
   */
  describe('while row visibility is still resolving', () => {
    it('shows a spinner instead of a partial row set when the config is loading', () => {
      appConfigMock.status = UserConfigStatus.Loading;

      render(<PreferencesTab />);

      expect(screen.getByLabelText(BasicI18nKeys.Loading)).toBeTruthy();
      expect(screen.queryByRole('combobox')).toBeNull();
      expect(screen.queryByText('default-agent-row')).toBeNull();
    });

    it('shows a spinner while the deployment catalog is loading', () => {
      deploymentsMock.isLoading = true;

      render(<PreferencesTab />);

      expect(screen.getByLabelText(BasicI18nKeys.Loading)).toBeTruthy();
      expect(screen.queryByRole('combobox')).toBeNull();
    });

    it('does not show the empty state while still resolving', () => {
      appConfigMock.status = UserConfigStatus.Loading;
      mockUiFeatures({ [OverlayFeature.HideUserSettings]: true });

      render(<PreferencesTab />);

      expect(screen.queryByText(BasicI18nKeys.Empty)).toBeNull();
    });

    it('keeps the heading visible so only the body swaps', () => {
      appConfigMock.status = UserConfigStatus.Loading;

      render(<PreferencesTab />);

      expect(screen.getByRole('heading', { level: 2 })).toBeTruthy();
    });

    it('renders the final row set once both have settled', () => {
      render(<PreferencesTab />);

      expect(screen.queryByLabelText(BasicI18nKeys.Loading)).toBeNull();
      expect(
        screen.getByRole('combobox', {
          name: SettingsI18nKeys.KeyboardShortcuts,
        }),
      ).toBeTruthy();
      expect(screen.getByText('default-agent-row')).toBeTruthy();
    });
  });

  it('renders the keyboard shortcut row with both options and an accessible name', () => {
    render(<PreferencesTab />);

    const select = screen.getByRole('combobox', {
      name: SettingsI18nKeys.KeyboardShortcuts,
    });
    expect(select).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect((select as HTMLSelectElement).value).toBe(SendOnEnter.Enter);
  });

  it('writes the meta-enter preference when that option is selected', async () => {
    render(<PreferencesTab />);

    await userEvent.selectOptions(
      screen.getByRole('combobox', {
        name: SettingsI18nKeys.KeyboardShortcuts,
      }),
      SendOnEnter.MetaEnter,
    );

    expect(setKeyboardPreference).toHaveBeenCalledWith(SendOnEnter.MetaEnter);
  });

  it('interpolates the platform modifier into the meta option label', () => {
    render(<PreferencesTab />);

    expect(
      screen.getByRole('option', {
        name: `${SettingsI18nKeys.ShortcutMetaEnter}:Ctrl`,
      }),
    ).toBeTruthy();
  });

  it('hides the keyboard row when keyboard shortcuts are hidden', () => {
    mockUiFeatures({ [OverlayFeature.HideKeyboardShortcuts]: true });

    render(<PreferencesTab />);

    expect(
      screen.queryByRole('combobox', {
        name: SettingsI18nKeys.KeyboardShortcuts,
      }),
    ).toBeNull();
  });

  it('renders the empty state when every row is hidden', () => {
    mockUiFeatures({ [OverlayFeature.HideUserSettings]: true });

    render(<PreferencesTab />);

    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText('default-agent-row')).toBeNull();
    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy();
    /* The pane must show the shared empty state, not just render bare. */
    expect(screen.getByText(BasicI18nKeys.Empty)).toBeTruthy();
  });

  /*
   * THEME SELECTOR — the theme row is commented out in PreferencesTab, parked for
   * an upcoming theming feature. Its tests are removed rather than skipped: a
   * permanently-skipped block rots silently. Re-add them alongside the row.
   */

  describe('language row', () => {
    it('is absent while only one locale is registered', () => {
      render(<PreferencesTab />);

      expect(
        screen.queryByRole('combobox', { name: SettingsI18nKeys.Language }),
      ).toBeNull();
    });

    it('renders one option per locale, labeled in its own script', () => {
      languageMock.supported = [
        { code: 'en', nativeName: 'English' },
        { code: 'ar', nativeName: 'العربية' },
      ];

      render(<PreferencesTab />);

      expect(screen.getByRole('option', { name: 'English' })).toBeTruthy();
      expect(screen.getByRole('option', { name: 'العربية' })).toBeTruthy();
    });

    it('matches a regional language code to its base option', () => {
      languageMock.supported = [
        { code: 'en', nativeName: 'English' },
        { code: 'ar', nativeName: 'العربية' },
      ];
      languageMock.language = 'en-US';

      render(<PreferencesTab />);

      const select = screen.getByRole('combobox', {
        name: SettingsI18nKeys.Language,
      });
      expect((select as HTMLSelectElement).value).toBe('en');
    });

    it('writes the chosen language', async () => {
      languageMock.supported = [
        { code: 'en', nativeName: 'English' },
        { code: 'ar', nativeName: 'العربية' },
      ];

      render(<PreferencesTab />);
      await userEvent.selectOptions(
        screen.getByRole('combobox', { name: SettingsI18nKeys.Language }),
        'ar',
      );

      expect(languageMock.changeLanguage).toHaveBeenCalledWith('ar');
    });
  });

  it('renders under an RTL locale without breakage', () => {
    languageMock.supported = [
      { code: 'en', nativeName: 'English' },
      { code: 'ar', nativeName: 'العربية' },
    ];
    document.documentElement.dir = 'rtl';

    try {
      render(<PreferencesTab />);

      /*
       * Layout is driven entirely by direction-agnostic and logical utilities,
       * so every row must still render with dir="rtl" on the root. Two
       * comboboxes: language and keyboard — the theme row is parked.
       */
      expect(screen.getAllByRole('combobox')).toHaveLength(2);
      expect(screen.getByText('default-agent-row')).toBeTruthy();
      expect(screen.getByRole('heading', { level: 2 })).toBeTruthy();
    } finally {
      document.documentElement.dir = '';
    }
  });

  describe('default agent row', () => {
    it('renders when an agent is pinned and the catalog is populated', () => {
      render(<PreferencesTab />);

      expect(screen.getByText('default-agent-row')).toBeTruthy();
    });

    /*
     * The pin is what gives the row's "Default agent" option something concrete
     * to refer to, so without it the row has nothing to offer. The flag defaults
     * to false, making this the shipping posture.
     */
    it('is absent when no agent is pinned', () => {
      appConfigMock.defaultDeploymentPinned = false;

      render(<PreferencesTab />);

      expect(screen.queryByText('default-agent-row')).toBeNull();
      /* Pinning gates only its own row. */
      expect(
        screen.getByRole('combobox', {
          name: SettingsI18nKeys.KeyboardShortcuts,
        }),
      ).toBeTruthy();
    });

    it('is absent when the catalog is empty', () => {
      deploymentsMock.items = [];

      render(<PreferencesTab />);

      expect(screen.queryByText('default-agent-row')).toBeNull();
      expect(
        screen.getByRole('combobox', {
          name: SettingsI18nKeys.KeyboardShortcuts,
        }),
      ).toBeTruthy();
    });

    it('is absent when user settings are hidden, even while pinned', () => {
      mockUiFeatures({ [OverlayFeature.HideUserSettings]: true });

      render(<PreferencesTab />);

      expect(screen.queryByText('default-agent-row')).toBeNull();
    });
  });
});

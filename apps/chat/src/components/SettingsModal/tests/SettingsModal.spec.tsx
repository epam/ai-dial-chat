import { SendOnEnter } from '@epam/ai-dial-conversation-input';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
} from '../../../constants/translation-keys';
import SettingsModal from '../SettingsModal';

const mocks = vi.hoisted(() => ({
  setTheme: vi.fn(),
  changeLanguage: vi.fn(),
  setKeyboard: vi.fn(),
  setAgent: vi.fn(),
  setIsCelebrationEnabled: vi.fn(),
  storedAgent: null as string | null,
  hasExtensions: true,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@epam/ai-dial-settings-panel', () => ({
  SettingsPanel: ({
    items,
    activeId,
    onSelect,
  }: {
    items: { id: string; label: string }[];
    activeId: string;
    onSelect: (id: string) => void;
  }) => (
    <div role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          aria-selected={item.id === activeId}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../../../hooks/useSettingsTabConfig', () => ({
  useSettingsTabConfig: () => ({
    items: [
      { id: 'preferences', label: 'Preferences' },
      ...(mocks.hasExtensions
        ? [{ id: 'extensions', label: 'Extensions' }]
        : []),
    ],
    tabComponents: {
      extensions: () => <p>extensions pane</p>,
    },
  }),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { MD: 20 },
  DIAL_KIT_ICON_STROKE: 1.5,
  mergeClasses: (...classes: (string | undefined | false)[]) =>
    classes.filter(Boolean).join(' '),
  ButtonVariant: { Primary: 'primary' },
  PopupSize: { Lg: 'lg' },
  Popup: ({
    header,
    children,
    mainButtons,
    onClose,
  }: {
    header: string;
    children: ReactNode;
    mainButtons: { label: string; onClick: () => void }[];
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label={header}>
      <button aria-label="close dialog" onClick={onClose} />
      {children}
      {mainButtons.map((button) => (
        <button key={button.label} onClick={button.onClick}>
          {button.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock(
  '../../../hooks/keyboard-shortcut/useKeyboardShortcutPreference',
  () => ({
    useKeyboardShortcutPreference: () => ({
      preference: SendOnEnter.Enter,
      setPreference: mocks.setKeyboard,
    }),
  }),
);
vi.mock('../../../hooks/language/useLanguage', () => ({
  useLanguage: () => ({ language: 'en', changeLanguage: mocks.changeLanguage }),
}));
vi.mock('../../../hooks/theme/useThemeOptions', () => ({
  useThemeOptions: () => ({
    options: [],
    selectedTheme: 'light',
    setTheme: mocks.setTheme,
  }),
}));
vi.mock('../../../hooks/default-agent/useDefaultAgentPreference', () => ({
  useDefaultAgentPreference: () => ({
    storedPreference: mocks.storedAgent,
    setPreference: mocks.setAgent,
  }),
}));

vi.mock('../../../hooks/celebration/useCelebrationPreference', () => ({
  useCelebrationPreference: () => ({
    isEnabled: false,
    setIsEnabled: mocks.setIsCelebrationEnabled,
  }),
}));

/* The rows have their own tests; this stub only drives the draft callbacks. */
vi.mock('../../Settings/PreferencesFields/PreferencesFields', () => ({
  default: ({
    theme,
    onThemeChange,
    onKeyboardChange,
    onDefaultAgentChange,
    isCelebrationEnabled,
    onCelebrationEnabledChange,
  }: {
    theme: string;
    onThemeChange: (value: string) => void;
    onKeyboardChange: (value: SendOnEnter) => void;
    onDefaultAgentChange?: (value: string) => void;
    isCelebrationEnabled: boolean;
    onCelebrationEnabledChange: (value: boolean) => void;
  }) => (
    <div>
      <span aria-label="draft theme">{theme}</span>
      <span aria-label="draft celebrations">
        {String(isCelebrationEnabled)}
      </span>
      <button onClick={() => onCelebrationEnabledChange(true)}>
        enable celebrations
      </button>
      <button onClick={() => onThemeChange('dark')}>pick dark</button>
      <button onClick={() => onKeyboardChange(SendOnEnter.MetaEnter)}>
        pick meta enter
      </button>
      <button onClick={() => onDefaultAgentChange?.('gpt-4o')}>
        pick agent
      </button>
    </div>
  ),
}));

describe('SettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storedAgent = null;
    mocks.hasExtensions = true;
  });

  it('opens as a dialog named Settings', () => {
    render(<SettingsModal onClose={vi.fn()} />);

    expect(
      screen.getByRole('dialog', { name: BasicI18nKeys.Settings }),
    ).toBeTruthy();
  });

  it('starts the draft from the stored values', () => {
    render(<SettingsModal onClose={vi.fn()} />);

    expect(screen.getByLabelText('draft theme').textContent).toBe('light');
  });

  it('applies nothing while the draft is edited', () => {
    render(<SettingsModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'pick dark' }));

    expect(mocks.setTheme).not.toHaveBeenCalled();
  });

  it('writes only the changed preferences on Save and closes', () => {
    const onClose = vi.fn();
    render(<SettingsModal onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'pick dark' }));
    fireEvent.click(screen.getByRole('button', { name: 'pick agent' }));
    fireEvent.click(screen.getByRole('button', { name: ButtonsI18nKeys.Save }));

    expect(mocks.setTheme).toHaveBeenCalledWith('dark');
    expect(mocks.setAgent).toHaveBeenCalledWith('gpt-4o');
    expect(mocks.setKeyboard).not.toHaveBeenCalled();
    expect(mocks.changeLanguage).not.toHaveBeenCalled();
    expect(mocks.setIsCelebrationEnabled).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('writes the celebrations opt-in only on Save', () => {
    render(<SettingsModal onClose={vi.fn()} />);

    expect(screen.getByLabelText('draft celebrations').textContent).toBe(
      'false',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'enable celebrations' }),
    );
    expect(screen.getByLabelText('draft celebrations').textContent).toBe(
      'true',
    );
    expect(mocks.setIsCelebrationEnabled).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: ButtonsI18nKeys.Save }));

    expect(mocks.setIsCelebrationEnabled).toHaveBeenCalledWith(true);
  });

  it('discards the celebrations opt-in on Cancel', () => {
    render(<SettingsModal onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'enable celebrations' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Cancel }),
    );

    expect(mocks.setIsCelebrationEnabled).not.toHaveBeenCalled();
  });

  it('discards the draft on Cancel', () => {
    const onClose = vi.fn();
    render(<SettingsModal onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'pick meta enter' }));
    fireEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Cancel }),
    );

    expect(mocks.setKeyboard).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('discards the draft when the dialog is closed', () => {
    const onClose = vi.fn();
    render(<SettingsModal onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'pick dark' }));
    fireEvent.click(screen.getByRole('button', { name: 'close dialog' }));

    expect(mocks.setTheme).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  describe('sections', () => {
    it('lists the configured sections and starts on Preferences', () => {
      render(<SettingsModal onClose={vi.fn()} />);

      const tabs = screen.getAllByRole('tab');
      expect(tabs.map((tab) => tab.textContent)).toEqual([
        'Preferences',
        'Extensions',
      ]);
      expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    });

    it('shows the Extensions section with only a Close button', () => {
      const onClose = vi.fn();
      render(<SettingsModal onClose={onClose} />);

      fireEvent.click(screen.getByRole('tab', { name: 'Extensions' }));

      expect(screen.getByText('extensions pane')).toBeTruthy();
      expect(
        screen.queryByRole('button', { name: ButtonsI18nKeys.Save }),
      ).toBeNull();
      fireEvent.click(
        screen.getByRole('button', { name: ButtonsI18nKeys.Close }),
      );
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('keeps the Preferences draft while another section is shown', () => {
      render(<SettingsModal onClose={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'pick dark' }));

      fireEvent.click(screen.getByRole('tab', { name: 'Extensions' }));
      fireEvent.click(screen.getByRole('tab', { name: 'Preferences' }));

      expect(screen.getByLabelText('draft theme').textContent).toBe('dark');
    });

    it('offers no Extensions section when the feature is off', () => {
      mocks.hasExtensions = false;
      render(<SettingsModal onClose={vi.fn()} />);

      expect(screen.queryByRole('tab', { name: 'Extensions' })).toBeNull();
    });
  });
});

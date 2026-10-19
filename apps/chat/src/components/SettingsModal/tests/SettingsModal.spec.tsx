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
  storedAgent: null as string | null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  ButtonVariant: { Primary: 'primary' },
  PopupSize: { Lg: 'lg' },
  DIAL_ICON_SIZE: { MD: 20 },
  DIAL_KIT_ICON_STROKE: 1.5,
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

/* The rows have their own tests; this stub only drives the draft callbacks. */
vi.mock('../../Settings/PreferencesFields/PreferencesFields', () => ({
  default: ({
    theme,
    onThemeChange,
    onKeyboardChange,
    onDefaultAgentChange,
  }: {
    theme: string;
    onThemeChange: (value: string) => void;
    onKeyboardChange: (value: SendOnEnter) => void;
    onDefaultAgentChange?: (value: string) => void;
  }) => (
    <div>
      <span aria-label="draft theme">{theme}</span>
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
    expect(onClose).toHaveBeenCalledOnce();
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
});

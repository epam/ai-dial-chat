import { SendOnEnter } from '@epam/ai-dial-conversation-input';
import { SettingsPanel } from '@epam/ai-dial-settings-panel';
import {
  ButtonVariant,
  mergeClasses,
  Popup,
  PopupSize,
} from '@epam/ai-dial-ui-kit';
import { memo, useCallback, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  SettingsI18nKeys,
} from '../../constants/translation-keys';
import { useDefaultAgentPreference } from '../../hooks/default-agent/useDefaultAgentPreference';
import { useKeyboardShortcutPreference } from '../../hooks/keyboard-shortcut/useKeyboardShortcutPreference';
import { useLanguage } from '../../hooks/language/useLanguage';
import { useThemeOptions } from '../../hooks/theme/useThemeOptions';
import { useSettingsTabConfig } from '../../hooks/useSettingsTabConfig';
import { SettingsTabs } from '../../types/settings-tabs';
import PreferencesFields from '../Settings/PreferencesFields/PreferencesFields';

interface Props {
  onClose: () => void;
}

/**
 * The Settings dialog opened from the sidebar's user menu. Its sections are the
 * configured Settings tabs. Preferences edits are held as a draft and written to
 * the stored preferences only on Save; Cancel, the close button and Escape
 * discard them. The other sections act on their own and the dialog only offers
 * Close. It is mounted only while open, so every opening starts from the stored
 * values.
 */
const SettingsModal: FC<Props> = ({ onClose }) => {
  const { t } = useTranslation();
  const { preference: storedKeyboard, setPreference: setKeyboard } =
    useKeyboardShortcutPreference();
  const { language: storedLanguage, changeLanguage } = useLanguage();
  const { selectedTheme: storedTheme, setTheme } = useThemeOptions();
  const { storedPreference: storedAgent, setPreference: setAgent } =
    useDefaultAgentPreference();

  const { items, tabComponents } = useSettingsTabConfig();
  const [activeId, setActiveId] = useState<string>(SettingsTabs.Preferences);
  const [theme, setThemeDraft] = useState(storedTheme);
  const [language, setLanguageDraft] = useState(storedLanguage);
  const [keyboard, setKeyboardDraft] = useState<SendOnEnter>(storedKeyboard);
  const [agent, setAgentDraft] = useState<string | undefined>(
    storedAgent ?? undefined,
  );

  const handleSave = useCallback(() => {
    if (theme !== storedTheme) setTheme(theme);
    if (language !== storedLanguage) changeLanguage(language);
    if (keyboard !== storedKeyboard) setKeyboard(keyboard);
    if (agent != null && agent !== (storedAgent ?? undefined)) setAgent(agent);
    onClose();
  }, [
    theme,
    storedTheme,
    setTheme,
    language,
    storedLanguage,
    changeLanguage,
    keyboard,
    storedKeyboard,
    setKeyboard,
    agent,
    storedAgent,
    setAgent,
    onClose,
  ]);

  const isPreferences = activeId === SettingsTabs.Preferences;
  const ActiveTab = tabComponents[activeId as SettingsTabs];
  const mainButtons = isPreferences
    ? [
        { label: t(ButtonsI18nKeys.Cancel), onClick: onClose },
        {
          label: t(ButtonsI18nKeys.Save),
          variant: ButtonVariant.Primary,
          onClick: handleSave,
        },
      ]
    : [
        {
          label: t(ButtonsI18nKeys.Close),
          variant: ButtonVariant.Primary,
          onClick: onClose,
        },
      ];

  return (
    <Popup
      open
      header={t(BasicI18nKeys.Settings)}
      size={PopupSize.Lg}
      className="h-[840px]! max-h-full! w-[1200px]! max-w-full!"
      bodyClassName="flex min-h-0 min-w-0 flex-1"
      onClose={onClose}
      mainButtons={mainButtons}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 px-4 py-2 desktop:flex-row desktop:gap-6 desktop:px-6">
        {/* A phone keeps the width for the section when there is only one. */}
        <SettingsPanel
          className={mergeClasses(
            'shrink-0 rounded-lg bg-layer-base desktop:w-[240px]',
            items.length < 2 && 'hidden desktop:flex',
          )}
          sectionLabel={t(BasicI18nKeys.Settings)}
          items={items}
          activeId={activeId}
          onSelect={setActiveId}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto pt-3">
          {isPreferences ? (
            <>
              <h3 className="dial-small-semi-text m-0 text-primary">
                {t(SettingsI18nKeys.General)}
              </h3>
              <div className="flex w-[400px] max-w-full min-w-0 flex-col gap-5">
                <PreferencesFields
                  theme={theme}
                  onThemeChange={setThemeDraft}
                  language={language}
                  onLanguageChange={setLanguageDraft}
                  keyboard={keyboard}
                  onKeyboardChange={setKeyboardDraft}
                  defaultAgent={agent}
                  onDefaultAgentChange={setAgentDraft}
                />
              </div>
            </>
          ) : (
            ActiveTab && <ActiveTab />
          )}
        </div>
      </div>
    </Popup>
  );
};

export default memo(SettingsModal);

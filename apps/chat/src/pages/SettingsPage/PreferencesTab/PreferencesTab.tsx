import { SendOnEnter } from '@epam/ai-dial-conversation-input';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import PreferencesFields from '../../../components/Settings/PreferencesFields/PreferencesFields';
import { SettingsI18nKeys } from '../../../constants/translation-keys';
import { useKeyboardShortcutPreference } from '../../../hooks/keyboard-shortcut/useKeyboardShortcutPreference';
import { useLanguage } from '../../../hooks/language/useLanguage';
import { useThemeOptions } from '../../../hooks/theme/useThemeOptions';

const PreferencesTab: FC = () => {
  const { t } = useTranslation();
  const {
    preference: keyboardPreference,
    setPreference: setKeyboardPreference,
  } = useKeyboardShortcutPreference();
  const { language, changeLanguage } = useLanguage();
  const { selectedTheme, setTheme } = useThemeOptions();

  return (
    <div className="flex size-full min-h-0 flex-col">
      <div className="flex flex-col gap-2 px-8 py-3">
        <h2 className="dial-h1-text m-0 text-primary">
          {t(SettingsI18nKeys.Preferences)}
        </h2>
        <p className="dial-small-text m-0 text-secondary">
          {t(SettingsI18nKeys.PreferencesDescription)}
        </p>
      </div>
      {/* Rows are capped rather than filling the pane: a 1500px-wide select for
          a three-word value reads as a layout bug, and the cap keeps the labels
          and controls in one scannable column. */}
      <div className="flex w-full max-w-md flex-1 flex-col gap-6 overflow-y-auto px-8 py-4">
        <PreferencesFields
          theme={selectedTheme}
          onThemeChange={setTheme}
          language={language}
          onLanguageChange={changeLanguage}
          keyboard={keyboardPreference}
          onKeyboardChange={(next: SendOnEnter) => setKeyboardPreference(next)}
        />
      </div>
    </div>
  );
};

export default memo(PreferencesTab);

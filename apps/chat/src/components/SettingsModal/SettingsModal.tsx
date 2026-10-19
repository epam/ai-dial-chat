import { SendOnEnter } from '@epam/ai-dial-conversation-input';
import {
  ButtonVariant,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Popup,
  PopupSize,
} from '@epam/ai-dial-ui-kit';
import { IconAdjustmentsHorizontal } from '@tabler/icons-react';
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
import PreferencesFields from '../Settings/PreferencesFields/PreferencesFields';

interface Props {
  onClose: () => void;
}

/**
 * The Settings dialog opened from the sidebar's user menu. Edits are held as a
 * draft and written to the stored preferences only on Save; Cancel, the close
 * button and Escape discard them. It is mounted only while open, so every
 * opening starts from the stored values.
 */
const SettingsModal: FC<Props> = ({ onClose }) => {
  const { t } = useTranslation();
  const { preference: storedKeyboard, setPreference: setKeyboard } =
    useKeyboardShortcutPreference();
  const { language: storedLanguage, changeLanguage } = useLanguage();
  const { selectedTheme: storedTheme, setTheme } = useThemeOptions();
  const { storedPreference: storedAgent, setPreference: setAgent } =
    useDefaultAgentPreference();

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

  return (
    <Popup
      open
      header={t(BasicI18nKeys.Settings)}
      size={PopupSize.Lg}
      className="!h-[840px] !max-h-full !w-[1200px] !max-w-full"
      bodyClassName="flex min-h-0 min-w-0 flex-1"
      onClose={onClose}
      mainButtons={[
        { label: t(ButtonsI18nKeys.Cancel), onClick: onClose },
        {
          label: t(ButtonsI18nKeys.Save),
          variant: ButtonVariant.Primary,
          onClick: handleSave,
        },
      ]}
    >
      <div className="flex min-h-0 min-w-0 flex-1 gap-6 px-4 py-2 desktop:px-6">
        {/* One section today, so a phone drops the side list and keeps the width. */}
        <nav
          aria-label={t(BasicI18nKeys.Settings)}
          className="hidden w-[240px] shrink-0 flex-col rounded-lg bg-layer-base p-2 desktop:flex"
        >
          <span
            aria-current="page"
            className="dial-small-text flex h-10 items-center gap-2 rounded-lg bg-control-accent-alpha px-3 text-accent"
          >
            <IconAdjustmentsHorizontal
              size={DIAL_ICON_SIZE.MD}
              stroke={DIAL_KIT_ICON_STROKE}
              aria-hidden
            />
            {t(SettingsI18nKeys.Preferences)}
          </span>
        </nav>
        <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto pt-3">
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
        </div>
      </div>
    </Popup>
  );
};

export default memo(SettingsModal);

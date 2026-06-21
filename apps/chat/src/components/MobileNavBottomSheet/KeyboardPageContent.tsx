import { SendOnEnter } from '@epam/ai-dial-conversation-input';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconCheck } from '@tabler/icons-react';
import { type FC, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsI18nKeys } from '../../constants/translation-keys';
import {
  metaKey,
  useKeyboardShortcutPreference,
} from '../../hooks/keyboard-shortcut/useKeyboardShortcutPreference';
import { useSheetNavigation } from '../../hooks/useSheetNavigation';

const KeyboardPageContent: FC = () => {
  const { t } = useTranslation();
  const { preference, setPreference } = useKeyboardShortcutPreference();
  const { pop } = useSheetNavigation();

  const options = [
    {
      value: SendOnEnter.Enter,
      label: t(SettingsI18nKeys.ShortcutEnter),
    },
    {
      value: SendOnEnter.MetaEnter,
      label: t(SettingsI18nKeys.ShortcutMetaEnter, { modifier: metaKey }),
    },
  ];

  const handleSelect = (value: SendOnEnter) => {
    setPreference(value);
    pop();
  };

  return (
    <ul className="flex flex-col py-2 pb-4">
      {options.map(({ value, label }) => {
        const isActive = preference === value;
        return (
          <li key={value}>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-[10px] text-start hover:bg-accent-primary-alpha"
              onClick={() => handleSelect(value)}
            >
              <span className="dial-small-text flex-1">{label}</span>
              {isActive && (
                <IconCheck
                  size={DIAL_ICON_SIZE.SM}
                  stroke={2}
                  aria-hidden
                  className="text-accent-primary"
                />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default memo(KeyboardPageContent);

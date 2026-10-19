import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { SendOnEnter } from '@epam/ai-dial-conversation-input';
import { NoDataContent, Select, Spinner } from '@epam/ai-dial-ui-kit';
import { memo, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  SettingsI18nKeys,
} from '../../../constants/translation-keys';
import {
  useAppConfig,
  useFeatureFlag,
} from '../../../context/AppConfigContext';
import { useDeployments } from '../../../context/DeploymentsContext';
import { metaKey } from '../../../hooks/keyboard-shortcut/useKeyboardShortcutPreference';
import { SUPPORTED_LANGUAGES } from '../../../hooks/language/useLanguage';
import { useThemeOptions } from '../../../hooks/theme/useThemeOptions';
import { useUiFeature } from '../../../hooks/useUiFeature';
import { UserConfigStatus } from '../../../types/user-config-status';
import DefaultAgentSelect from '../DefaultAgentSelect/DefaultAgentSelect';

interface Props {
  theme: string;
  onThemeChange: (theme: string) => void;
  language: string;
  onLanguageChange: (language: string) => void;
  keyboard: SendOnEnter;
  onKeyboardChange: (keyboard: SendOnEnter) => void;
  /** The default-agent preference shown instead of the stored one; omit to edit the stored one directly. */
  defaultAgent?: string;
  onDefaultAgentChange?: (agent: string) => void;
}

/**
 * The preference rows (theme, language, keyboard shortcut, default agent) with
 * their visibility rules. It holds no state of its own: the Settings tab binds
 * it to the stored preferences so edits apply at once, and the Settings dialog
 * binds it to a draft that is applied on Save.
 */
const PreferencesFields: FC<Props> = ({
  theme,
  onThemeChange,
  language,
  onLanguageChange,
  keyboard,
  onKeyboardChange,
  defaultAgent,
  onDefaultAgentChange,
}) => {
  const { t } = useTranslation();
  const isUserSettingsHidden = useUiFeature(OverlayFeature.HideUserSettings);
  const isKeyboardShortcutsHidden = useUiFeature(
    OverlayFeature.HideKeyboardShortcuts,
  );
  const { items: deploymentItems, isLoading: isDeploymentsLoading } =
    useDeployments();
  const { options: themeOptions } = useThemeOptions();
  const { status: appConfigStatus } = useAppConfig();
  const isDefaultDeploymentPinned = useFeatureFlag('defaultDeploymentPinned');

  /*
   * Two of the visibility rules below depend on data that arrives over the
   * network: `useFeatureFlag` reports `false` until the client config is Ready,
   * and `deploymentItems` is empty until the catalog loads. Rendering the rows
   * before both settle makes the default-agent row pop in late, next to a
   * keyboard row that came from localStorage instantly. Holding the body until
   * the row set is final trades a brief spinner for a stable layout.
   */
  const isResolvingRows =
    appConfigStatus === UserConfigStatus.Loading || isDeploymentsLoading;

  const isKeyboardRowShown =
    !isUserSettingsHidden && !isKeyboardShortcutsHidden;
  /*
   * Offered only where the operator pinned a specific agent
   * (DEFAULT_DEPLOYMENT_PINNED). The pin is what makes the row's first option,
   * "Default agent", refer to something concrete; without it there is no
   * operator choice to keep, override, or fall back to. Pinning therefore
   * unlocks the user's override rather than forbidding it — see
   * `resolveInitialSelection`, where an explicitly named agent still outranks
   * the pin.
   */
  const isDefaultAgentRowShown =
    !isUserSettingsHidden &&
    isDefaultDeploymentPinned &&
    deploymentItems.length > 0;
  const isLanguageRowShown =
    !isUserSettingsHidden && SUPPORTED_LANGUAGES.length > 1;
  /*
   * One option is not a choice — a deployment serving a single theme gets no
   * row rather than a select the user can only reselect the current value in.
   */
  const isThemeRowShown = !isUserSettingsHidden && themeOptions.length > 1;

  /*
   * `i18n.language` can be a regional code (`en-US`) while the options are base
   * codes, so both sides are reduced to their base code before comparing.
   * Comparing bases rather than prefix-matching keeps this correct if a
   * regional code is ever registered alongside its base — `en` would otherwise
   * shadow `en-GB` purely by list order.
   */
  const selectedLanguage = useMemo(() => {
    const [base] = language.split('-');
    return (
      SUPPORTED_LANGUAGES.find(({ code }) => code.split('-')[0] === base)
        ?.code ?? language
    );
  }, [language]);

  const languageOptions = useMemo(
    () =>
      SUPPORTED_LANGUAGES.map(({ code, nativeName }) => ({
        value: code,
        label: nativeName,
      })),
    [],
  );

  const keyboardOptions = useMemo(
    () => [
      {
        value: SendOnEnter.Enter,
        label: t(SettingsI18nKeys.ShortcutEnter),
      },
      {
        value: SendOnEnter.MetaEnter,
        label: t(SettingsI18nKeys.ShortcutMetaEnter, { modifier: metaKey }),
      },
    ],
    [t],
  );

  const hasAnyRow =
    isThemeRowShown ||
    isLanguageRowShown ||
    isKeyboardRowShown ||
    isDefaultAgentRowShown;

  return (
    <>
      {isResolvingRows && (
        <div className="flex flex-1 items-center justify-center">
          <Spinner fullWidth={false} ariaLabel={t(BasicI18nKeys.Loading)} />
        </div>
      )}
      {!isResolvingRows && !hasAnyRow && (
        <NoDataContent title={t(BasicI18nKeys.Empty)} />
      )}
      {!isResolvingRows && isThemeRowShown && (
        <Select
          labelProps={{ label: t(SettingsI18nKeys.Theme) }}
          options={themeOptions}
          value={theme}
          onChange={(next) => onThemeChange(next as string)}
        />
      )}
      {!isResolvingRows && isLanguageRowShown && (
        <Select
          labelProps={{ label: t(SettingsI18nKeys.Language) }}
          options={languageOptions}
          value={selectedLanguage}
          onChange={(next) => onLanguageChange(next as string)}
        />
      )}
      {!isResolvingRows && isKeyboardRowShown && (
        <Select
          labelProps={{ label: t(SettingsI18nKeys.KeyboardShortcuts) }}
          options={keyboardOptions}
          value={keyboard}
          onChange={(next) => onKeyboardChange(next as SendOnEnter)}
        />
      )}
      {!isResolvingRows && isDefaultAgentRowShown && (
        <DefaultAgentSelect
          value={defaultAgent}
          onChange={onDefaultAgentChange}
        />
      )}
    </>
  );
};

export default memo(PreferencesFields);

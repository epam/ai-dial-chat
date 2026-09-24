import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { SendOnEnter } from '@epam/ai-dial-conversation-input';
import { NoDataContent, Select, Spinner } from '@epam/ai-dial-ui-kit';
import { memo, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import DefaultAgentSelect from '../../../components/Settings/DefaultAgentSelect/DefaultAgentSelect';
import {
  BasicI18nKeys,
  SettingsI18nKeys,
} from '../../../constants/translation-keys';
import {
  useAppConfig,
  useFeatureFlag,
} from '../../../context/AppConfigContext';
import { useDeployments } from '../../../context/DeploymentsContext';
import {
  metaKey,
  useKeyboardShortcutPreference,
} from '../../../hooks/keyboard-shortcut/useKeyboardShortcutPreference';
import {
  SUPPORTED_LANGUAGES,
  useLanguage,
} from '../../../hooks/language/useLanguage';
import { useThemeOptions } from '../../../hooks/theme/useThemeOptions';
import { useUiFeature } from '../../../hooks/useUiFeature';
import { UserConfigStatus } from '../../../types/user-config-status';

const PreferencesTab: FC = () => {
  const { t } = useTranslation();
  const isUserSettingsHidden = useUiFeature(OverlayFeature.HideUserSettings);
  const isKeyboardShortcutsHidden = useUiFeature(
    OverlayFeature.HideKeyboardShortcuts,
  );
  const {
    preference: keyboardPreference,
    setPreference: setKeyboardPreference,
  } = useKeyboardShortcutPreference();
  const { items: deploymentItems, isLoading: isDeploymentsLoading } =
    useDeployments();
  const { language, changeLanguage } = useLanguage();
  const { options: themeOptions, selectedTheme, setTheme } = useThemeOptions();
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
            value={selectedTheme}
            onChange={(next) => setTheme(next as string)}
          />
        )}
        {!isResolvingRows && isLanguageRowShown && (
          <Select
            labelProps={{ label: t(SettingsI18nKeys.Language) }}
            options={languageOptions}
            value={selectedLanguage}
            onChange={(next) => changeLanguage(next as string)}
          />
        )}
        {!isResolvingRows && isKeyboardRowShown && (
          <Select
            labelProps={{ label: t(SettingsI18nKeys.KeyboardShortcuts) }}
            options={keyboardOptions}
            value={keyboardPreference}
            onChange={(next) => setKeyboardPreference(next as SendOnEnter)}
          />
        )}
        {!isResolvingRows && isDefaultAgentRowShown && <DefaultAgentSelect />}
      </div>
    </div>
  );
};

export default memo(PreferencesTab);

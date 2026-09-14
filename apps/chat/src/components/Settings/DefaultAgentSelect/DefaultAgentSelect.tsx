import { DeploymentIcon } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  Highlight,
  Select,
  type SelectOption,
} from '@epam/ai-dial-ui-kit';
import { memo, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DeploymentSelectorI18nKeys,
  SettingsI18nKeys,
} from '../../../constants/translation-keys';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useDefaultAgentPreference } from '../../../hooks/default-agent/useDefaultAgentPreference';
import { useLanguage } from '../../../hooks/language/useLanguage';
import { DefaultAgentMode } from '../../../types/default-agent';
import { resolveCatalogIconUrl } from '../../../utils/icon-path';
import { resolveLocalizedText } from '../../../utils/locale';

/**
 * The agent a new chat opens on: the two modes carried over from chat 1.0
 * ("Default agent", "Last used agent") followed by every deployment in the
 * catalog. The mode rows come first and carry no icon, so they read as modes
 * rather than as agents.
 */
const DefaultAgentSelect: FC = () => {
  const { t } = useTranslation();
  const { language: activeLocale } = useLanguage();
  const { items } = useDeployments();
  const { preference, setPreference } = useDefaultAgentPreference();
  const [searchQuery, setSearchQuery] = useState('');

  const options = useMemo<SelectOption[]>(() => {
    const modeOptions: SelectOption[] = [
      {
        value: DefaultAgentMode.DefaultAgent,
        label: t(SettingsI18nKeys.DefaultAgentOptionDefault),
      },
      {
        value: DefaultAgentMode.LastUsedAgent,
        label: t(SettingsI18nKeys.DefaultAgentOptionLastUsed),
      },
    ];

    const deploymentOptions: SelectOption[] = items.map((item) => {
      const name =
        resolveLocalizedText(item.displayName, activeLocale) || item.id;
      return {
        value: item.id,
        /* Kept as a plain string so the field and the built-in filter still work. */
        label: name,
        labelNode: <Highlight text={name} query={searchQuery} />,
        icon: (
          <DeploymentIcon
            src={resolveCatalogIconUrl(item.iconUrl)}
            size={DIAL_ICON_SIZE.MD}
            initialsName={name}
          />
        ),
        ...(item.displayVersion && {
          rightControl: (
            <span className="dial-tiny-text text-secondary">
              {item.displayVersion}
            </span>
          ),
        }),
      };
    });

    return [...modeOptions, ...deploymentOptions];
  }, [t, items, activeLocale, searchQuery]);

  return (
    <Select
      labelProps={{ label: t(SettingsI18nKeys.DefaultAgent) }}
      options={options}
      value={preference}
      onChange={(next) => setPreference(next as string)}
      searchable
      searchPlaceholder={t(DeploymentSelectorI18nKeys.SearchPlaceholder)}
      onSearchQueryChange={setSearchQuery}
    />
  );
};

export default memo(DefaultAgentSelect);

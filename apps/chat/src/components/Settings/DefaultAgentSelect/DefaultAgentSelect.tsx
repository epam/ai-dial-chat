import { Label } from '@epam/ai-dial-ui-kit';
import { memo, useId, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import DeploymentSelectorFieldTrigger from '../../../components/DeploymentSelector/DeploymentSelectorFieldTrigger';
import type { DeploymentSelectorExtraOption } from '../../../components/DeploymentSelector/DeploymentSelectorPanel';
import {
  DeploymentSelectorI18nKeys,
  SettingsI18nKeys,
} from '../../../constants/translation-keys';
import { useFeatureFlag } from '../../../context/AppConfigContext';
import { useDefaultAgentPreference } from '../../../hooks/default-agent/useDefaultAgentPreference';
import { DefaultAgentMode } from '../../../types/default-agent';

/**
 * The agent a new chat opens on. It is the same picker the chat input opens —
 * search, Current Selected, Favorites, Catalog — so the preference is chosen
 * the way an agent is chosen everywhere else, and the panel stays cheap to open
 * because it never materialises the whole catalog. The two modes carried over
 * from chat 1.0 ("Default agent", "Last used agent") ride along as icon-less
 * rows pinned above the catalog sections, so they read as modes rather than
 * as agents.
 *
 * Until the user picks something the field shows the mode that is actually in
 * effect rather than a fixed default: with an agent pinned that is "Default
 * agent", because the pin outranks the implicit last-used selection. Showing
 * "Last used agent" there would name a mode the new chat does not follow —
 * the confusion behind Issue #8889.
 */
const DefaultAgentSelect: FC = () => {
  const { t } = useTranslation();
  const { storedPreference, setPreference } = useDefaultAgentPreference();
  const isDefaultDeploymentPinned = useFeatureFlag('defaultDeploymentPinned');
  const labelId = useId();

  const effectiveMode = isDefaultDeploymentPinned
    ? DefaultAgentMode.DefaultAgent
    : DefaultAgentMode.LastUsedAgent;
  const selectedId = storedPreference ?? effectiveMode;

  const modeOptions = useMemo<DeploymentSelectorExtraOption[]>(
    () => [
      {
        id: DefaultAgentMode.DefaultAgent,
        label: t(SettingsI18nKeys.DefaultAgentOptionDefault),
      },
      {
        id: DefaultAgentMode.LastUsedAgent,
        label: t(SettingsI18nKeys.DefaultAgentOptionLastUsed),
      },
    ],
    [t],
  );

  return (
    <div className="flex flex-col gap-1">
      <Label id={labelId} label={t(SettingsI18nKeys.DefaultAgent)} />
      <DeploymentSelectorFieldTrigger
        selectedId={selectedId}
        onSelect={setPreference}
        placeholder={t(DeploymentSelectorI18nKeys.AriaLabel)}
        labelledById={labelId}
        extraOptions={modeOptions}
      />
    </div>
  );
};

export default memo(DefaultAgentSelect);

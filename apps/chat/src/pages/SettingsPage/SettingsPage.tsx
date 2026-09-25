import { SettingsPanel } from '@epam/ai-dial-settings-panel';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router';
import { BasicI18nKeys } from '../../constants/translation-keys';
import { useSettingsTabConfig } from '../../hooks/useSettingsTabConfig';
import { SettingsTabs } from '../../types/settings-tabs';
import { buildSettingsTabPath } from '../../utils/routes';

const SettingsPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items, tabComponents } = useSettingsTabConfig();
  const { tab } = useParams<{ tab: string }>();

  /*
   * The tab is resolved against the ids the config actually returned, not
   * against `SettingsTabs`: a member can exist in the enum while its entry is
   * withheld, and rendering that id would leave an empty pane.
   */
  const activeItem = items.find((item) => item.id === tab);
  const defaultItem = items[0];

  if (defaultItem == null) {
    /* Nothing to route to, so navigating would loop. Render the shell's own
       empty state instead. */
    return (
      <div className="flex size-full min-h-0 flex-col bg-layer-base">
        <h1 className="sr-only">{t(BasicI18nKeys.Settings)}</h1>
      </div>
    );
  }

  if (activeItem == null) {
    return (
      <Navigate
        to={buildSettingsTabPath(defaultItem.id as SettingsTabs)}
        replace
      />
    );
  }

  const ActiveTabComponent = tabComponents[activeItem.id as SettingsTabs];

  return (
    /* Mobile stacks the section list above the active tab, full width; the
     * desktop keeps the 240px side column. */
    <div className="flex size-full min-h-0 flex-col bg-layer-base desktop:flex-row">
      <h1 className="sr-only">{t(BasicI18nKeys.Settings)}</h1>
      <SettingsPanel
        className="shrink-0 border-b border-b-tertiary desktop:w-[240px] desktop:border-b-0 desktop:border-e desktop:border-e-tertiary desktop:shadow-sm"
        sectionLabel={t(BasicI18nKeys.Settings)}
        items={items}
        activeId={activeItem.id}
        onSelect={(id) => navigate(buildSettingsTabPath(id as SettingsTabs))}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {ActiveTabComponent && <ActiveTabComponent />}
      </div>
    </div>
  );
};

export default memo(SettingsPage);

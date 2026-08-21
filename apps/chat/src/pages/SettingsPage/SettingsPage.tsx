import { SettingsPanel } from '@epam/ai-dial-settings-panel';
import { memo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { BasicI18nKeys } from '../../constants/translation-keys';
import { useSettingsTabConfig } from '../../hooks/useSettingsTabConfig';
import { SettingsTabs } from '../../types/settings-tabs';

const SettingsPage: FC = () => {
  const { t } = useTranslation();
  const { items, tabComponents } = useSettingsTabConfig();
  const [activeTab, setActiveTab] = useState<SettingsTabs>(SettingsTabs.Usage);

  const ActiveTabComponent = tabComponents[activeTab];

  return (
    <div className="flex size-full min-h-0 bg-layer-base">
      <h1 className="sr-only">{t(BasicI18nKeys.Settings)}</h1>
      <SettingsPanel
        className="w-[240px] shrink-0 border-e border-e-tertiary shadow-sm"
        sectionLabel={t(BasicI18nKeys.Settings)}
        items={items}
        activeId={activeTab}
        onSelect={(id) => setActiveTab(id as SettingsTabs)}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {ActiveTabComponent && <ActiveTabComponent />}
      </div>
    </div>
  );
};

export default memo(SettingsPage);

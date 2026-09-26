import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { Tabs, TabOrientation } from '@epam/ai-dial-ui-kit';
import { type FC } from 'react';
import { SETTINGS_PANEL_CLASS } from '../../constants/public-class-names';
import type { SettingsPanelProps } from '../../models/settings-panel-props';

/** Vertical icon + label navigation panel with a roving-tabindex ARIA tablist. */
export const SettingsPanel: FC<SettingsPanelProps> = ({
  items,
  activeId,
  onSelect,
  sectionLabel,
  styles: settingsPanelStyles,
  className,
}) => {
  const { sectionLabelClassName = 'dial-h1-text' } =
    settingsPanelStyles?.typography ?? {};

  /*
   * The kit reports every click, including one on the already-active row;
   * this component's contract is that `onSelect` marks a change of section.
   */
  const handleTabChange = (id: string) => {
    if (id !== activeId) onSelect(id);
  };

  return (
    <div
      className={mergeClasses(
        'flex min-h-0 flex-col bg-layer-raised',
        className,
        SETTINGS_PANEL_CLASS.panel,
      )}
    >
      <Tabs
        orientation={TabOrientation.Vertical}
        sectionLabel={sectionLabel}
        tabs={items}
        activeTabId={activeId}
        onTabChange={handleTabChange}
        className="min-h-0 grow"
        tabListClassName={SETTINGS_PANEL_CLASS.tabList}
        tabClassName={SETTINGS_PANEL_CLASS.tab}
        sectionLabelClassName={sectionLabelClassName}
      />
    </div>
  );
};

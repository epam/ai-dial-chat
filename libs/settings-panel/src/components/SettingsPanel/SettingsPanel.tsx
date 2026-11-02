import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { Tabs, TabOrientation } from '@epam/ai-dial-ui-kit';
import { type FC } from 'react';
import { SETTINGS_PANEL_CLASS } from '../../constants/public-class-names';
import type { SettingsPanelProps } from '../../models/settings-panel-props';
import styles from './SettingsPanel.module.scss';

/** Vertical icon + label navigation panel with a roving-tabindex ARIA tablist. */
export const SettingsPanel: FC<SettingsPanelProps> = ({
  items,
  activeId,
  onSelect,
  sectionLabel,
  ariaLabel,
  styles: settingsPanelStyles,
  className,
}) => {
  const { sectionLabelClassName = 'dial-h1-text' } =
    settingsPanelStyles?.typography ?? {};
  const cssVars = buildCssVars({
    '--sp-bg': settingsPanelStyles?.colors?.background,
  });

  /*
   * The kit reports every click, including one on the already-active row;
   * this component's contract is that `onSelect` marks a change of section.
   */
  const handleTabChange = (id: string) => {
    if (id !== activeId) onSelect(id);
  };

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        'flex min-h-0 flex-col',
        styles.panel,
        className,
        SETTINGS_PANEL_CLASS.panel,
      )}
    >
      <Tabs
        orientation={TabOrientation.Vertical}
        sectionLabel={sectionLabel}
        ariaLabel={ariaLabel}
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

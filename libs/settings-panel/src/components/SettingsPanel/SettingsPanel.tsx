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
  styles: settingsPanelStyles,
  className,
}) => {
  const { sectionLabelClassName = 'dial-h1-text' } =
    settingsPanelStyles?.typography ?? {};
  const colors = settingsPanelStyles?.colors;
  const cssVars = buildCssVars({
    '--sp-section-label-text': colors?.sectionLabelText,
    '--sp-row-text': colors?.rowText,
    '--sp-row-bg-hover': colors?.rowBackgroundHover,
    '--sp-active-row-bg': colors?.activeRowBackground,
    '--sp-active-row-bg-hover': colors?.activeRowBackgroundHover,
    '--sp-active-row-text': colors?.activeRowText,
    '--sp-row-focus-outline': colors?.rowFocusOutline,
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
      className={mergeClasses(
        'flex min-h-0 flex-col bg-layer-raised',
        className,
        SETTINGS_PANEL_CLASS.panel,
      )}
      style={cssVars}
    >
      <Tabs
        orientation={TabOrientation.Vertical}
        sectionLabel={sectionLabel}
        tabs={items}
        activeTabId={activeId}
        onTabChange={handleTabChange}
        className="min-h-0 grow"
        tabListClassName={SETTINGS_PANEL_CLASS.tabList}
        tabClassName={mergeClasses(styles.row, SETTINGS_PANEL_CLASS.tab)}
        sectionLabelClassName={mergeClasses(
          styles.sectionLabel,
          sectionLabelClassName,
        )}
      />
    </div>
  );
};

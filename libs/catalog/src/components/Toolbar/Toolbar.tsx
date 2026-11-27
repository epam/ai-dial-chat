import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type CSSProperties, FC } from 'react';
import { CATALOG_CLASS } from '../../constants/public-class-names';
import { ToolbarProps } from '../../models/toolbar-props';
import { TitleRow } from './Rows/TitleRow';
import styles from './Toolbar.module.scss';

/** Browse section header: folder heading, search with view/sort/filter controls, applied-topic tags. */
export const Toolbar: FC<ToolbarProps> = ({
  searchPlaceholder = 'Search models, tools, agents…',
  ...innerProps
}) => {
  const cssVars = {
    '--cat-browse-settings-dot': innerProps.styles?.colors?.settingsActiveDot,
  } as CSSProperties;

  return (
    <section
      className={mergeClasses(
        'shrink-0 px-4',
        styles.section,
        CATALOG_CLASS.toolbar,
      )}
      style={cssVars}
    >
      <TitleRow searchPlaceholder={searchPlaceholder} {...innerProps} />
    </section>
  );
};

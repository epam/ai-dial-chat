import { DIAL_ICON_SIZE, Tooltip } from '@epam/ai-dial-ui-kit';
import { IconSitemapFilled } from '@tabler/icons-react';
import { FC } from 'react';
import { buildCssVars } from '../../utils/build-css-vars';
import styles from './OrgUnitFolderIcon.module.scss';

/** Color overrides for `OrgUnitFolderIcon`. */
export interface OrgUnitFolderIconColors {
  /** Icon fill. Defaults to `--stroke-gradient-1`, the fill of the kit folder icon. */
  icon?: string;
}

/** Props of `OrgUnitFolderIcon`. */
export interface OrgUnitFolderIconProps {
  /** Accessible name and tooltip of the icon. Defaults to `'Organization unit'`. */
  label?: string;
  /** Color overrides, applied as CSS custom properties. */
  colors?: OrgUnitFolderIconColors;
}

/** Filled sitemap icon in the folder icon's color, marking a folder as a DIAL Core org unit. */
export const OrgUnitFolderIcon: FC<OrgUnitFolderIconProps> = ({
  label = 'Organization unit',
  colors,
}) => (
  /* The kit wrapper carries the tooltip; the image keeps the name, so it is not announced twice. */
  <Tooltip tooltip={label} triggerClassName={styles.trigger}>
    <span
      role="img"
      aria-label={label}
      className={styles.icon}
      style={buildCssVars({ '--oufi-icon': colors?.icon })}
    >
      <IconSitemapFilled size={DIAL_ICON_SIZE.MD} aria-hidden />
    </span>
  </Tooltip>
);

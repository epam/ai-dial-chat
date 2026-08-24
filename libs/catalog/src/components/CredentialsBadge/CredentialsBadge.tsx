import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, Tooltip } from '@epam/ai-dial-ui-kit';
import { IconAlertTriangleFilled } from '@tabler/icons-react';
import { FC } from 'react';
import type { CatalogItemCredentials } from '../../models/catalog-item-credentials';
import { getCredentialsBadgeState } from '../../utils/toolset-credentials';
import styles from './CredentialsBadge.module.scss';

/** Props for `CredentialsBadge`. */
export interface CredentialsBadgeProps {
  /** Credential status to render a badge for. Renders nothing when absent, when authentication is `NONE`, or when signed in at any level. */
  credentials?: CatalogItemCredentials;
  /** Accessible label for the icon and the text shown in its hover tooltip. Default: `'Authorize to use this toolset.'`. */
  loggedOutLabel?: string;
  /** Additional CSS class applied to the badge's root element (e.g. to override its corner position). */
  className?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: CredentialsBadgeColors;
}

/** Color overrides for `CredentialsBadge`, applied as CSS custom properties. */
export interface CredentialsBadgeColors {
  /** Color of the stroke drawn around the icon's outline, separating it from the avatar. Fallback: `--bg-layer-raised`. */
  halo?: string;
  /** Icon fill color. Fallback: `--text-warning-icon`. */
  icon?: string;
}

/** Warning icon anchored to the entity avatar's bottom-end corner — only rendered when signed out. */
export const CredentialsBadge: FC<CredentialsBadgeProps> = ({
  credentials,
  loggedOutLabel = 'Authorize to use this toolset.',
  className,
  colors,
}) => {
  if (credentials == null) return null;

  const state = getCredentialsBadgeState(credentials);
  if (state == null) return null;

  const cssVars = buildCssVars({
    '--cat-cred-badge-halo': colors?.halo,
    '--cat-cred-badge-icon': colors?.icon,
  });

  return (
    <Tooltip tooltip={loggedOutLabel} asChild>
      <span
        role="img"
        aria-label={loggedOutLabel}
        style={cssVars}
        className={mergeClasses(
          'absolute -bottom-1 -end-1 shrink-0',
          className,
        )}
      >
        <IconAlertTriangleFilled
          size={DIAL_ICON_SIZE.SM}
          className={styles.icon}
          aria-hidden
        />
      </span>
    </Tooltip>
  );
};

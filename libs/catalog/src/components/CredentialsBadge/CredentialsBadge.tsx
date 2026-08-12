import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialTag } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import type { CatalogItemCredentials } from '../../models/catalog-item-credentials';
import { getCredentialsBadgeState } from '../../utils/toolset-credentials';
import styles from './CredentialsBadge.module.scss';

/** Props for `CredentialsBadge`. */
export interface CredentialsBadgeProps {
  /** Credential status to render a badge for. Renders nothing when absent, when authentication is `NONE`, or when signed in at any level. */
  credentials?: CatalogItemCredentials;
  /** Badge label shown when signed out. Default: `'LOGGED OUT'`. */
  loggedOutLabel?: string;
  /** Additional CSS class applied for layout/spacing (e.g. margins). */
  className?: string;
  /** Typography class for the badge itself. Default: `'dial-caption-lead-semi-text'`. Colors come from the module stylesheet. */
  badgeClassName?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: CredentialsBadgeColors;
}

/** Color overrides for `CredentialsBadge`, applied as CSS custom properties. */
export interface CredentialsBadgeColors {
  /** Badge background color. Fallback: `--bg-error`. */
  background?: string;
  /** Badge text color. Fallback: `--text-error`. */
  text?: string;
}

/** Credential-status badge shown on toolset cards — only rendered when signed out. */
export const CredentialsBadge: FC<CredentialsBadgeProps> = ({
  credentials,
  loggedOutLabel = 'LOGGED OUT',
  className,
  badgeClassName = 'dial-caption-lead-semi-text',
  colors,
}) => {
  if (credentials == null) return null;

  const state = getCredentialsBadgeState(credentials);
  if (state == null) return null;

  return (
    /* `DialTag` takes no `style`, so the variables go on a `display: contents`
     * wrapper — it generates no box and leaves layout untouched. */
    <span
      className="contents"
      style={buildCssVars({
        '--cat-credentials-badge-bg': colors?.background,
        '--cat-credentials-badge-text': colors?.text,
      })}
    >
      <DialTag
        label={loggedOutLabel}
        className={mergeClasses(
          'border-none',
          styles.badge,
          badgeClassName,
          className,
        )}
      />
    </span>
  );
};

import { mergeClasses } from '@epam/ai-dial-chat-shared';
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
  /** Typography class for the badge itself. Default: `'dial-caption-semi-text uppercase tracking-[0.06em]'`. Colors come from the module stylesheet. */
  badgeClassName?: string;
}

/** Credential-status badge shown on toolset cards — only rendered when signed out. */
export const CredentialsBadge: FC<CredentialsBadgeProps> = ({
  credentials,
  loggedOutLabel = 'LOGGED OUT',
  className,
  badgeClassName = 'dial-caption-semi-text uppercase',
}) => {
  if (credentials == null) return null;

  const state = getCredentialsBadgeState(credentials);
  if (state == null) return null;

  return (
    <DialTag
      label={loggedOutLabel}
      className={mergeClasses(
        'border-none tracking-[0.06em]',
        styles.badge,
        badgeClassName,
        className,
      )}
    />
  );
};

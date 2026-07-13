import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialTag } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import type { CatalogItemCredentials } from '../../models/catalog-item-credentials';
import { getCredentialsBadgeState } from '../../utils/toolset-credentials';

/** Props for `CredentialsBadge`. */
export interface CredentialsBadgeProps {
  /** Credential status to render a badge for. Renders nothing when absent, when authentication is `NONE`, or when signed in at any level. */
  credentials?: CatalogItemCredentials;
  /** Badge label shown when signed out. Default: `'LOGGED OUT'`. */
  loggedOutLabel?: string;
  /** Additional CSS class applied to the outer wrapper (layout/spacing only). */
  className?: string;
}

/** Credential-status badge shown on toolset cards — only rendered when signed out. */
export const CredentialsBadge: FC<CredentialsBadgeProps> = ({
  credentials,
  loggedOutLabel = 'LOGGED OUT',
  className,
}) => {
  if (credentials == null) return null;

  const state = getCredentialsBadgeState(credentials);
  if (state == null) return null;

  return (
    <DialTag
      label={loggedOutLabel}
      className={mergeClasses(
        'border-none bg-error text-[10px] font-semibold uppercase tracking-[0.06em] text-error',
        className,
      )}
    />
  );
};

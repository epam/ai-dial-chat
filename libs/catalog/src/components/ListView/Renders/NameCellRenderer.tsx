import {
  DeploymentIcon,
  ItemHeader,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconCheck } from '@tabler/icons-react';
import type { ICellRendererParams } from 'ag-grid-community';
import { FC } from 'react';
import type { CatalogItem } from '../../../models/catalog-item';
import { GridContext } from '../../../models/grid-context';
import { CredentialsBadge } from '../../CredentialsBadge/CredentialsBadge';
import styles from '../ListView.module.scss';

/** ag-grid cell renderer for the name/identity column: icon, name, version, credentials badge, and selection checkmark. */
export const NameCellRenderer: FC<
  ICellRendererParams<CatalogItem, unknown, GridContext>
> = ({ data, context }) => {
  const searchQuery = context?.searchQuery ?? '';
  const typography = context?.typography;
  const nameClassName = typography?.nameClassName ?? 'dial-small-semi-text';
  const versionClassName = typography?.versionClassName ?? 'dial-tiny-text';
  const isSelected = data != null && data.id === context?.selectedItemId;

  if (!data) return null;
  return (
    <div className="flex h-full min-w-0 items-center gap-2.5">
      <DeploymentIcon
        src={data.iconUrl}
        size={36}
        initialsName={data.name}
        styles={{ badgeClassName: 'rounded-[10px]' }}
      />
      <ItemHeader
        title={data.name}
        postfix={data.version}
        postfixClassName={versionClassName}
        query={searchQuery}
        titleClassName={nameClassName}
        className="min-w-0 items-baseline gap-1.5"
        trailing={
          isSelected ? (
            <IconCheck
              size={DIAL_ICON_SIZE.SM}
              className={mergeClasses('shrink-0', styles.selectedCheck)}
              aria-hidden
            />
          ) : undefined
        }
      />
      <CredentialsBadge
        credentials={data.credentials}
        loggedOutLabel={context?.credentialsBadgeLoggedOutLabel}
        className="ms-2 shrink-0"
      />
    </div>
  );
};

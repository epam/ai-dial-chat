import { DeploymentIcon, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  EllipsisTooltip,
} from '@epam/ai-dial-ui-kit';
import { IconCheck } from '@tabler/icons-react';
import type { ICellRendererParams } from 'ag-grid-community';
import { FC } from 'react';
import type { CatalogItem } from '../../../models/catalog-item';
import { GridContext } from '../../../models/grid-context';
import { ClampedName } from '../../ClampedName/ClampedName';
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
    <div className="flex h-full w-full min-w-0 items-center gap-2.5">
      <div className="relative shrink-0">
        <DeploymentIcon
          src={data.iconUrl}
          size={36}
          initialsName={data.name}
          styles={{ badgeClassName: 'rounded-[10px]' }}
        />
        <CredentialsBadge
          credentials={data.credentials}
          loggedOutLabel={context?.credentialsBadgeLoggedOutLabel}
        />
      </div>
      {/* Not `ItemHeader`: its title is single-line, and a long agent name
       * has to wrap within the 60px row instead of truncating (#9121). The
       * header keeps the cell's width (`flex-1`) so the version, capped at
       * 30%, is measured against the column rather than the name's own text. */}
      <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
        <h3
          className={mergeClasses('min-w-0 shrink', nameClassName, styles.name)}
        >
          <ClampedName
            name={data.name}
            query={searchQuery}
            className="whitespace-normal"
          />
        </h3>
        {data.version && (
          <EllipsisTooltip
            text={data.version}
            className={mergeClasses(
              'max-w-[30%] shrink-0',
              versionClassName,
              styles.version,
            )}
          />
        )}
        {isSelected && (
          <IconCheck
            size={DIAL_ICON_SIZE.SM}
            className={mergeClasses('ms-auto shrink-0', styles.selectedCheck)}
            aria-hidden
            stroke={DIAL_KIT_ICON_STROKE}
          />
        )}
      </div>
    </div>
  );
};

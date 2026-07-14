import {
  DeploymentIcon,
  Highlight,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconCheck } from '@tabler/icons-react';
import type { ICellRendererParams } from 'ag-grid-community';
import { FC } from 'react';
import type { CatalogItem } from '../../../models/catalog-item';
import { GridContext } from '../../../models/grid-context';
import { CredentialsBadge } from '../../CredentialsBadge/CredentialsBadge';
import { ItemHeader } from '../../ItemHeader/ItemHeader';
import styles from '../ListView.module.scss';

export const NameCellRenderer: FC<
  ICellRendererParams<CatalogItem, unknown, GridContext>
> = ({ data, context }) => {
  const searchQuery = context?.searchQuery ?? '';
  const typography = context?.typography;
  const nameClassName = typography?.nameClassName ?? 'dial-h3-text';
  const versionClassName = typography?.versionClassName ?? 'dial-tiny-text';
  const descriptionClassName =
    typography?.descriptionClassName ?? 'dial-small-text';
  const isSelected = data != null && data.id === context?.selectedItemId;

  if (!data) return null;
  return (
    <div className="flex h-full items-center gap-2.5">
      <DeploymentIcon src={data.iconUrl} size={48} initialsName={data.name} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <ItemHeader
          title={data.name}
          postfix={data.version}
          postfixClassName={versionClassName}
          query={searchQuery}
          titleClassName={nameClassName}
          className="items-baseline gap-1.5"
          trailing={
            isSelected ? (
              <IconCheck
                size={DIAL_ICON_SIZE.SM}
                className="shrink-0 text-accent-primary"
                aria-hidden
              />
            ) : undefined
          }
        />
        <p className={mergeClasses(descriptionClassName, styles.secondaryText)}>
          <Highlight text={data.description} query={searchQuery} maxLines={2} />
        </p>
      </div>
      <CredentialsBadge
        credentials={data.credentials}
        loggedOutLabel={context?.credentialsBadgeLoggedOutLabel}
        className="ms-2 shrink-0"
      />
    </div>
  );
};

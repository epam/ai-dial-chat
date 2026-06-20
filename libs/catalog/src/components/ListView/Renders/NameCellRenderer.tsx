import {
  DeploymentIcon,
  Highlight,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import type { ICellRendererParams } from 'ag-grid-community';
import { FC } from 'react';
import type { CatalogItem } from '../../../models/catalog-item';
import { GridContext } from '../../../models/grid-context';
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

  if (!data) return null;
  return (
    <div className="flex h-full items-center gap-2.5">
      <DeploymentIcon src={data.iconUrl} size={48} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <ItemHeader
          title={data.name}
          postfix={data.version}
          postfixClassName={versionClassName}
          query={searchQuery}
          titleClassName={nameClassName}
          className="items-baseline gap-1.5"
        />
        <p className={mergeClasses(descriptionClassName, styles.secondaryText)}>
          <Highlight text={data.description} query={searchQuery} />
        </p>
      </div>
    </div>
  );
};

import type { ICellRendererParams } from 'ag-grid-community';
import { FC } from 'react';
import type { CatalogItem } from '../../../models/catalog';
import { GridContext } from '../../../models/GridContext';
import { Highlight } from '../../Highlight/Highlight';
import { ProviderLogo } from '../../ProviderLogo/ProviderLogo';
import styles from '../CatalogListView.module.scss';

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
      <ProviderLogo color={data.logoColor} initial={data.logoInitial} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-baseline gap-1.5">
          <span className={[nameClassName, styles.nameText].join(' ')}>
            <Highlight text={data.name} query={searchQuery} />
          </span>
          <span className={[versionClassName, styles.secondaryText].join(' ')}>
            {data.version}
          </span>
        </div>
        <p
          className={[
            'm-0 overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]',
            descriptionClassName,
            styles.secondaryText,
          ].join(' ')}
        >
          <Highlight text={data.description} query={searchQuery} />
        </p>
      </div>
    </div>
  );
};

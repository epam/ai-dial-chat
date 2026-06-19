import {
  DeploymentIcon,
  Highlight,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import type { ICellRendererParams } from 'ag-grid-community';
import { FC } from 'react';
<<<<<<< HEAD:libs/catalog/src/components/ListView/Renders/NameCellRenderer.tsx
import type { CatalogItem } from '../../../models/catalog-item';
import { GridContext } from '../../../models/grid-context';
import { EntityBadge } from '../../EntityBadge/EntityBadge';
import { ItemHeader } from '../../ItemHeader/ItemHeader';
import styles from '../ListView.module.scss';
=======
import type { CatalogItem } from '../../../models/catalog';
import { GridContext } from '../../../models/GridContext';
import { Highlight } from '../../Highlight/Highlight';
import { ProviderLogo } from '../../ProviderLogo/ProviderLogo';
import styles from '../CatalogListView.module.scss';
>>>>>>> b4b22eef2c3e54e0f61784c59613d383bcdd3a5e:libs/catalog/src/components/CatalogListView/Renders/NameCellRenderer.tsx

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
<<<<<<< HEAD:libs/catalog/src/components/ListView/Renders/NameCellRenderer.tsx
        <EntityBadge type={data.type} />
        <ItemHeader
          title={data.name}
          count={data.version}
          countClassName={versionClassName}
          query={searchQuery}
          titleClassName={nameClassName}
          className="items-baseline gap-1.5"
        />
=======
        <div className="flex items-baseline gap-1.5">
          <span className={[nameClassName, styles.nameText].join(' ')}>
            <Highlight text={data.name} query={searchQuery} />
          </span>
          <span className={[versionClassName, styles.secondaryText].join(' ')}>
            {data.version}
          </span>
        </div>
>>>>>>> b4b22eef2c3e54e0f61784c59613d383bcdd3a5e:libs/catalog/src/components/CatalogListView/Renders/NameCellRenderer.tsx
        <p
          className={mergeClasses(
            'm-0 overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]',
            descriptionClassName,
            styles.secondaryText,
          )}
        >
          <Highlight text={data.description} query={searchQuery} />
        </p>
      </div>
    </div>
  );
};

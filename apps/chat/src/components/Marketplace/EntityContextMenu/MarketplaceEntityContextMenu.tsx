import { useMemo } from 'react';

import classNames from 'classnames';

import { FeatureType } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';

import { ContextMenu } from '@/src/components/Common/ContextMenu';

interface Props<T, D> {
  entity: T;
  featureType: FeatureType;
  disabledActions?: D;
  className?: string;
  isPreview?: boolean;
  triggerIconSize?: number;
  useMenuItems: (params: {
    entity: T;
    disabledActions?: D;
    isPreview?: boolean;
  }) => DisplayMenuItemProps[];
}

export function MarketplaceEntityContextMenu<T, D>({
  entity,
  featureType,
  disabledActions = {} as D,
  className,
  isPreview = false,
  triggerIconSize = 18,
  useMenuItems,
}: Props<T, D>) {
  const params = useMemo(
    () => ({
      entity,
      disabledActions,
      isPreview,
    }),
    [disabledActions, entity, isPreview],
  );

  const menuItems = useMenuItems(params);

  return (
    <ContextMenu
      menuItems={menuItems}
      featureType={featureType}
      triggerIconHighlight
      triggerIconSize={triggerIconSize}
      className={classNames('m-0', className)}
    />
  );
}

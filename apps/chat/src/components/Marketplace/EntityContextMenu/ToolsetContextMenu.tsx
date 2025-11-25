import classNames from 'classnames';

import { useToolsetMenuItems } from '@/src/hooks/useToolsetMenuItems';

import {
  ToolsetContextMenuDisabledActions,
  ToolsetModel,
} from '@/src/types/toolsets';

import { ContextMenu } from '@/src/components/Common/ContextMenu';

import { FeatureType } from '@epam/ai-dial-shared';

interface ToolsetContextMenuProps {
  entity: ToolsetModel;
  disabledActions?: ToolsetContextMenuDisabledActions;
  className?: string;
  isPreview?: boolean;
  triggerIconSize?: number;
}

export const ToolsetContextMenu: React.FC<ToolsetContextMenuProps> = (
  props,
) => {
  const { triggerIconSize = 18, className } = props;
  const menuItems = useToolsetMenuItems(props);

  return (
    <ContextMenu
      menuItems={menuItems}
      featureType={FeatureType.Toolset}
      triggerIconHighlight
      triggerIconSize={triggerIconSize}
      className={classNames('m-0', className)}
    />
  );
};

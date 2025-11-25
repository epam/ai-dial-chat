import classNames from 'classnames';

import { useAgentMenuItems } from '@/src/hooks/useAgentMenuItems';

import { ApplicationContextMenuDisabledActions } from '@/src/types/applications';
import { DialAIEntityModel } from '@/src/types/models';

import { ContextMenu } from '@/src/components/Common/ContextMenu';

import { FeatureType } from '@epam/ai-dial-shared';

interface AgentContextMenuProps {
  entity: DialAIEntityModel;
  disabledActions?: ApplicationContextMenuDisabledActions;
  className?: string;
  isPreview?: boolean;
  triggerIconSize?: number;
}

export const AgentContextMenu: React.FC<AgentContextMenuProps> = (props) => {
  const { triggerIconSize = 18, className } = props;
  const menuItems = useAgentMenuItems(props);

  return (
    <ContextMenu
      menuItems={menuItems}
      featureType={FeatureType.Application}
      triggerIconHighlight
      triggerIconSize={triggerIconSize}
      className={classNames('m-0', className)}
    />
  );
};

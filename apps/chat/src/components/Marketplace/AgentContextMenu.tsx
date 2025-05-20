import { useMemo } from 'react';

import classNames from 'classnames';

import { useAgentMenuItems } from '@/src/hooks/useAgentMenuItems';

import { FeatureType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';

import { ContextMenu } from '@/src/components/Common/ContextMenu';

interface Props {
  entity: DialAIEntityModel;
  disabledActions?: {
    copyLink?: boolean;
    deploy?: boolean;
    edit?: boolean;
    share?: boolean;
    unshare?: boolean;
    publish?: boolean;
    unpublish?: boolean;
    logs?: boolean;
    delete?: boolean;
  };
  className?: string;
  isPreview?: boolean;
  triggerIconSize?: number;
}

export const AgentContextMenu: React.FC<Props> = ({
  entity,
  disabledActions = {},
  className,
  isPreview = false,
  triggerIconSize = 18,
}) => {
  const agentMenuItemsParams = useMemo(
    () => ({
      entity,
      disabledActions,
      isPreview,
    }),
    [disabledActions, entity, isPreview],
  );

  const menuItems = useAgentMenuItems(agentMenuItemsParams);

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

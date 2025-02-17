import { DialAIEntityModel } from '@/src/types/models';

import { PublishActions } from '@epam/ai-dial-shared';

export interface AgentTableRowItemProps {
  entity: DialAIEntityModel;
  isHovered: boolean;
  onClick: (entity: DialAIEntityModel) => void;
  onRowHoverOver: () => void;
  onRowHover: (id: string) => void;
  onPublish?: (entity: DialAIEntityModel, action: PublishActions) => void;
  onDelete?: (entity: DialAIEntityModel) => void;
  onEdit?: (entity: DialAIEntityModel) => void;
  onBookmarkClick?: (entity: DialAIEntityModel) => void;
  onLogsClick?: (entity: DialAIEntityModel) => void;
}

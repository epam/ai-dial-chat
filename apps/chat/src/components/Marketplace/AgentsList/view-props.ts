import { DialAIEntityModel } from '@/src/types/models';

import { PublishActions } from '@epam/ai-dial-shared';

export interface AgentsListProps {
  entities: DialAIEntityModel[];
  suggestedResults: DialAIEntityModel[];
  separator: string;
  onCardClick: (entity: DialAIEntityModel) => void;
  onPublish?: (entity: DialAIEntityModel, action: PublishActions) => void;
  onDelete?: (entity: DialAIEntityModel) => void;
  onEdit?: (entity: DialAIEntityModel) => void;
  onBookmarkClick?: (entity: DialAIEntityModel) => void;
  onSelectVersion?: (entity: DialAIEntityModel) => void;
  onLogsClick?: (entity: DialAIEntityModel) => void;
}

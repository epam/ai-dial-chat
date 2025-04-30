import { DialAIEntityModel } from '@/src/types/models';

export interface AgentsListProps {
  entities: DialAIEntityModel[];
  suggestedResults: DialAIEntityModel[];
  separator: string;
  onCardClick: (entity: DialAIEntityModel) => void;
  onBookmarkClick?: (entity: DialAIEntityModel) => void;
  onSelectVersion?: (entity: DialAIEntityModel) => void;
}

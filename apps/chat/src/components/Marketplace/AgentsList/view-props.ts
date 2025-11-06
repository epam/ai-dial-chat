export interface AgentsListProps<T> {
  entities: T[];
  suggestedResults: T[];
  separator: string;
  onCardClick: (entity: T) => void;
  onBookmarkClick?: (entity: T) => void;
  onSelectVersion?: (entity: T) => void;
}

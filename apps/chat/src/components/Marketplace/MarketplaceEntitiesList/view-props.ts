export interface MarketplaceEntitiesListProps<T> {
  entities: T[];
  suggestedResults: T[];
  separator: string;
  onCardClick: (entity: T) => void;
  onBookmarkClick?: (entity: T) => void;
  onSelectVersion?: (entity: T) => void;
}

export interface MarketplaceEntitiesListWrapperRef {
  parentRef: React.RefObject<HTMLDivElement | null>;
  suggestedRowRef: React.RefObject<HTMLSpanElement | null>;
}

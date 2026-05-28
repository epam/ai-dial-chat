import React from 'react';

export interface MarketplaceEntitiesListProps<T> {
  entities: T[];
  suggestedResults: T[];
  featuredEntities: T[];
  onCardClick: (entity: T) => void;
  onBookmarkClick?: (entity: T) => void;
  onSelectVersion?: (entity: T) => void;
}

export interface MarketplaceEntitiesListWrapperRef {
  parentRef: React.RefObject<HTMLDivElement | null>;
}

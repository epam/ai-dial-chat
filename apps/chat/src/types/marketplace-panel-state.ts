import { FilterTypes } from '@/src/constants/marketplace';

export interface MarketplacePanelState {
  [FilterTypes.ENTITY_TYPE]: boolean;
  // [FilterTypes.CAPABILITIES]: boolean;
  // [FilterTypes.ENVIRONMENT]: boolean;
  [FilterTypes.TOPICS]: boolean;
  [FilterTypes.SOURCES]: boolean;
  [FilterTypes.AUTH]: boolean;
}

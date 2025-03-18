import { FeatureType } from '@/src/types/common';
import {
  PublicVersionGroups,
  Publication,
  PublicationInfo,
  PublicationRule,
  ResourceToReview,
} from '@/src/types/publication';

export interface PublicationState {
  initialized: boolean;
  publications: (PublicationInfo & Partial<Publication>)[];
  selectedPublicationUrl: string | null;
  resourcesToReview: ResourceToReview[];
  rules: Record<string, PublicationRule[]>;
  isRulesLoading: boolean;
  allPublishedWithMeItemsUploaded: {
    [FeatureType.Chat]: boolean;
    [FeatureType.Prompt]: boolean;
    [FeatureType.File]: boolean;
    [FeatureType.Application]: boolean;
  };
  selectedItemsToPublish: string[];
  isApplicationReview: boolean;
  publicVersionGroups: PublicVersionGroups;
}

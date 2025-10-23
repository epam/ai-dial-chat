import { beforeEach, describe, expect, it, vi } from 'vitest';

import { doesMarketplaceEntityMatchFilters } from '@/src/utils/marketplace';

import { ApplicationType } from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { ToolsetModel } from '@/src/types/toolsets';

import { FilterTypes, SourceType } from '@/src/constants/marketplace';

import {
  getApplicationType,
  isApplicationTypeKey,
  isDialAiEntityModel,
  isMarketplaceEntityPublic,
} from '../application';
import { pluralizeDisplayName } from '../application-type-schema';
import { isMyApplication, isMyToolset } from '../id';

// Mock dependencies
vi.mock('../application', () => ({
  isDialAiEntityModel: vi.fn(),
  getApplicationType: vi.fn(),
  isMarketplaceEntityPublic: vi.fn(),
  isApplicationTypeKey: vi.fn(),
}));

vi.mock('../application-type-schema', () => ({
  pluralizeDisplayName: vi.fn(),
}));

vi.mock('../id', () => ({
  isMyApplication: vi.fn(),
  isMyToolset: vi.fn(),
}));

describe('doesMarketplaceEntityMatchFilters', () => {
  enum MockTopics {
    Business = 'Business',
    Development = 'Development',
  }
  const mockModel = {
    type: EntityType.Application,
    topics: [MockTopics.Business, MockTopics.Development],
    sharedWithMe: false,
  } as DialAIEntityModel;

  const mockToolset = {
    type: EntityType.Toolset,
    topics: [MockTopics.Business, MockTopics.Development],
    sharedWithMe: false,
  } as ToolsetModel;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when no filters are applied', () => {
    const result = doesMarketplaceEntityMatchFilters(mockModel, {});
    expect(result).toBe(true);
  });

  describe('Entity Type filtering', () => {
    it('returns false when entity type does not match filter', () => {
      const filters = {
        [FilterTypes.ENTITY_TYPE]: [EntityType.Model],
      };

      const result = doesMarketplaceEntityMatchFilters(mockModel, filters);
      expect(result).toBe(false);
    });

    it('returns true when entity type matches filter', () => {
      const filters = {
        [FilterTypes.ENTITY_TYPE]: [EntityType.Application],
      };

      const result = doesMarketplaceEntityMatchFilters(mockModel, filters);
      expect(result).toBe(true);
    });
  });

  describe('Topics filtering', () => {
    it('returns false when no topics intersect', () => {
      const filters = {
        [FilterTypes.TOPICS]: ['Science', 'Math'],
      };

      const result = doesMarketplaceEntityMatchFilters(mockModel, filters);
      expect(result).toBe(false);
    });

    it('returns true when topics intersect', () => {
      const filters = {
        [FilterTypes.TOPICS]: [MockTopics.Business, MockTopics.Development],
      };

      const result = doesMarketplaceEntityMatchFilters(mockModel, filters);
      expect(result).toBe(true);
    });
  });

  describe('Sources filtering for DialAI entities', () => {
    beforeEach(() => {
      vi.mocked(isDialAiEntityModel).mockReturnValue(true);
    });

    it('returns true for public source when entity is public', () => {
      vi.mocked(isMarketplaceEntityPublic).mockReturnValue(true);

      const filters = {
        [FilterTypes.SOURCES]: [SourceType.Public],
      };

      const result = doesMarketplaceEntityMatchFilters(mockModel, filters);
      expect(result).toBe(true);
    });

    it('returns true for shared source when entity is shared', () => {
      const sharedModel = { ...mockModel, sharedWithMe: true };

      const filters = {
        [FilterTypes.SOURCES]: [SourceType.SharedWithMe],
      };

      const result = doesMarketplaceEntityMatchFilters(sharedModel, filters);
      expect(result).toBe(true);
    });

    it('returns true for application type source match', () => {
      vi.mocked(isMyApplication).mockReturnValue(true);
      vi.mocked(getApplicationType).mockReturnValue(ApplicationType.CODE_APP);
      vi.mocked(isApplicationTypeKey).mockReturnValue(true);

      const filters = {
        [FilterTypes.SOURCES]: [SourceType.MyCodeApps],
      };

      const result = doesMarketplaceEntityMatchFilters(mockModel, filters);
      expect(result).toBe(true);
    });

    it('returns true for display name source match', () => {
      vi.mocked(isMyApplication).mockReturnValue(true);
      vi.mocked(getApplicationType).mockReturnValue('custom_app_schema');
      vi.mocked(isApplicationTypeKey).mockReturnValue(false);
      vi.mocked(pluralizeDisplayName).mockReturnValue('My Custom apps');

      const schemas = [{ id: 'custom_app_schema', displayName: 'Custom app' }];
      const filters = {
        [FilterTypes.SOURCES]: [SourceType.MyCustomApps],
      };

      const result = doesMarketplaceEntityMatchFilters(
        mockModel,
        filters,
        schemas,
      );
      expect(result).toBe(true);
      expect(pluralizeDisplayName).toHaveBeenCalledWith('Custom app');
    });

    it('returns false when no source conditions match', () => {
      vi.mocked(isMarketplaceEntityPublic).mockReturnValue(false);
      vi.mocked(isMyApplication).mockReturnValue(false);

      const filters = {
        [FilterTypes.SOURCES]: [SourceType.Public],
      };

      const result = doesMarketplaceEntityMatchFilters(mockModel, filters);
      expect(result).toBe(false);
    });
  });

  describe('Sources filtering for Toolsets entities', () => {
    beforeEach(() => {
      vi.mocked(isDialAiEntityModel).mockReturnValue(false);
    });

    it('returns true for public source', () => {
      vi.mocked(isMarketplaceEntityPublic).mockReturnValue(true);

      const filters = {
        [FilterTypes.SOURCES]: [SourceType.Public],
      };

      const result = doesMarketplaceEntityMatchFilters(mockToolset, filters);
      expect(result).toBe(true);
    });

    it('returns true for my toolsets source', () => {
      vi.mocked(isMyToolset).mockReturnValue(true);

      const filters = {
        [FilterTypes.SOURCES]: [SourceType.MyToolsets],
      };

      const result = doesMarketplaceEntityMatchFilters(mockToolset, filters);
      expect(result).toBe(true);
    });

    it('returns false when no source conditions match', () => {
      vi.mocked(isMarketplaceEntityPublic).mockReturnValue(false);
      vi.mocked(isMyToolset).mockReturnValue(false);

      const filters = {
        [FilterTypes.SOURCES]: [SourceType.Public],
      };

      const result = doesMarketplaceEntityMatchFilters(mockToolset, filters);
      expect(result).toBe(false);
    });
  });
});

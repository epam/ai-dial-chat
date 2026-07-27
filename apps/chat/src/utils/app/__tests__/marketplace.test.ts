import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  doesMarketplaceEntityMatchFilters,
  getDetailsEntity,
  getFilters,
  getLinkErrorMessage,
  getTableSort,
  getTabs,
  isPersonalSourceType,
} from '@/src/utils/marketplace';

import { ApplicationType } from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import { DetailsEntity } from '@/src/types/marketplace';
import { DialAIEntityModel } from '@/src/types/models';
import { ToolsetCredentialsLevel, ToolsetModel } from '@/src/types/toolsets';

import {
  FilterTypes,
  MarketplaceEntitiesTabs,
  MarketplaceTabs,
  SourceType,
  TableColumnSortKeys,
  ToolsetAuthFilter,
} from '@/src/constants/marketplace';

import {
  getApplicationType,
  isApplicationTypeKey,
  isDialAiEntityModel,
  isMarketplaceEntityPublic,
} from '../application';
import { pluralizeDisplayName } from '../application-type-schema';
import { isMyApplication, isMyToolset } from '../id';

import { ToolsetAuthStatus, ToolsetAuthTypes } from '@epam/ai-dial-shared';
import { ParsedUrlQuery } from 'querystring';

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

  describe('Authentication filtering for Toolsets entities', () => {
    const buildToolset = (
      authenticationType: ToolsetAuthTypes,
      globalStatus: ToolsetAuthStatus,
      userStatus: ToolsetAuthStatus,
    ) =>
      ({
        ...mockToolset,
        authSettings: {
          authenticationType,
          authStatus: {
            [ToolsetCredentialsLevel.GLOBAL]: globalStatus,
            [ToolsetCredentialsLevel.USER]: userStatus,
            [ToolsetCredentialsLevel.APP]: ToolsetAuthStatus.SIGNED_OUT,
          },
        },
      }) as ToolsetModel;

    it('matches "Without Authentication" toolsets', () => {
      const toolset = buildToolset(
        ToolsetAuthTypes.NONE,
        ToolsetAuthStatus.SIGNED_OUT,
        ToolsetAuthStatus.SIGNED_OUT,
      );
      const filters = {
        [FilterTypes.AUTH]: [ToolsetAuthFilter.WithoutAuth],
      };

      expect(doesMarketplaceEntityMatchFilters(toolset, filters)).toBe(true);
    });

    it('matches "Org creds" when signed in at global level', () => {
      const toolset = buildToolset(
        ToolsetAuthTypes.OAUTH,
        ToolsetAuthStatus.SIGNED_IN,
        ToolsetAuthStatus.SIGNED_OUT,
      );
      expect(
        doesMarketplaceEntityMatchFilters(toolset, {
          [FilterTypes.AUTH]: [ToolsetAuthFilter.OrgCreds],
        }),
      ).toBe(true);
      expect(
        doesMarketplaceEntityMatchFilters(toolset, {
          [FilterTypes.AUTH]: [ToolsetAuthFilter.LoggedOut],
        }),
      ).toBe(false);
    });

    it('matches "My creds" when signed in at user level', () => {
      const toolset = buildToolset(
        ToolsetAuthTypes.API_KEY,
        ToolsetAuthStatus.SIGNED_OUT,
        ToolsetAuthStatus.SIGNED_IN,
      );
      expect(
        doesMarketplaceEntityMatchFilters(toolset, {
          [FilterTypes.AUTH]: [ToolsetAuthFilter.MyCreds],
        }),
      ).toBe(true);
    });

    it('matches "Logged out" when auth required but not signed in', () => {
      const toolset = buildToolset(
        ToolsetAuthTypes.OAUTH,
        ToolsetAuthStatus.SIGNED_OUT,
        ToolsetAuthStatus.SIGNED_OUT,
      );
      expect(
        doesMarketplaceEntityMatchFilters(toolset, {
          [FilterTypes.AUTH]: [ToolsetAuthFilter.LoggedOut],
        }),
      ).toBe(true);
    });

    it('returns false for non-toolset entities when auth filter applied', () => {
      const filters = {
        [FilterTypes.AUTH]: [ToolsetAuthFilter.WithoutAuth],
      };
      expect(doesMarketplaceEntityMatchFilters(mockModel, filters)).toBe(false);
    });
  });
});

describe('isPersonalSourceType', () => {
  it('returns true for known personal source types', () => {
    expect(isPersonalSourceType(SourceType.SharedWithMe)).toBe(true);
    expect(isPersonalSourceType(SourceType.MyCustomApps)).toBe(true);
    expect(isPersonalSourceType(SourceType.MyCodeApps)).toBe(true);
    expect(isPersonalSourceType(SourceType.MyToolsets)).toBe(true);
  });

  it('returns true for dynamic custom application-type source names starting with "My "', () => {
    expect(isPersonalSourceType('My Custom Schema apps')).toBe(true);
  });

  it('returns false for the public source type', () => {
    expect(isPersonalSourceType(SourceType.Public)).toBe(false);
  });
});

//epic utils
describe('Marketplace epic utils', () => {
  const mockModel: DialAIEntityModel = {
    type: EntityType.Application,
    reference: 'model-ref',
    isDefault: false,
    id: 'applications/test-app',
    name: 'test-app',
  };

  const mockToolset: ToolsetModel = {
    type: EntityType.Toolset,
    reference: 'toolset-ref',
  } as ToolsetModel;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDetailsEntity', () => {
    it('returns model entity info when model query param matches', () => {
      const result = getDetailsEntity({
        entitiesMap: { [mockModel.reference]: mockModel },
        reference: mockModel.reference,
        type: MarketplaceEntitiesTabs.AGENTS,
      });
      expect(result).toEqual({
        reference: mockModel.reference,
        isSuggested: false,
        type: MarketplaceEntitiesTabs.AGENTS,
      });
    });

    it('returns toolset entity info when toolset query param matches', () => {
      const result = getDetailsEntity({
        entitiesMap: { [mockToolset.reference]: mockToolset },
        reference: mockToolset.reference,
        type: MarketplaceEntitiesTabs.TOOLSETS,
      });
      expect(result).toEqual({
        reference: mockToolset.reference,
        isSuggested: false,
        type: MarketplaceEntitiesTabs.TOOLSETS,
      });
    });

    it('returns undefined if neither model nor toolset found', () => {
      expect(
        getDetailsEntity({
          entitiesMap: { [mockModel.reference]: mockModel },
          reference: 'bad-ref',
          type: MarketplaceEntitiesTabs.AGENTS,
        }),
      ).toBeUndefined();
    });
  });

  describe('getTabs', () => {
    it('returns MY_WORKSPACE tab when query.tab matches', () => {
      const query: ParsedUrlQuery = {
        tab: 'workspace',
        entitiesTab: 'toolsets',
      };
      const result = getTabs(query);
      expect(result.selectedTab).toBe(MarketplaceTabs.MY_WORKSPACE);
      expect(result.selectedEntitiesTab).toBe(MarketplaceEntitiesTabs.TOOLSETS);
    });

    it('defaults to HOME/AGENTS when query params missing', () => {
      const result = getTabs({});
      expect(result.selectedTab).toBe(MarketplaceTabs.HOME);
      expect(result.selectedEntitiesTab).toBe(MarketplaceEntitiesTabs.AGENTS);
    });
  });

  describe('getFilters', () => {
    it('filters topics, types, and sources correctly', () => {
      const query: ParsedUrlQuery = {
        topics: 'Analysis,Development',
        types: 'application',
        sources: `${SourceType.MyCodeApps},Public`,
      };
      const existingTopics = ['Analysis'];
      const sourceTypes: SourceType[] = [
        SourceType.MyCodeApps,
        SourceType.Public,
      ];

      const result = getFilters(query, existingTopics, sourceTypes);
      expect(result.Topics).toEqual(['Analysis']);
      expect(result.Type).toEqual(['application']);
      expect(result.Sources).toEqual([
        SourceType.MyCodeApps,
        SourceType.Public,
      ]);
    });

    it('returns empty arrays when no matches', () => {
      const result = getFilters({}, [], []);
      expect(result.Topics).toEqual([]);
      expect(result.Type).toEqual([]);
      expect(result.Sources).toEqual([]);
    });
  });

  describe('getTableSort', () => {
    it('parses valid table sort param', () => {
      const query: ParsedUrlQuery = {
        tableSort: `${TableColumnSortKeys.OWNER}-desc`,
      };
      const result = getTableSort(query);
      expect(result).toEqual({
        column: TableColumnSortKeys.OWNER,
        order: 'desc',
      });
    });

    it('falls back to NAME & asc if invalid column or order', () => {
      const query: ParsedUrlQuery = { tableSort: 'invalid-badorder' };
      const result = getTableSort(query);
      expect(result).toEqual({
        column: TableColumnSortKeys.NAME,
        order: 'asc',
      });
    });

    it('returns defaults if no tableSort query', () => {
      expect(getTableSort({})).toEqual({
        column: TableColumnSortKeys.NAME,
        order: 'asc',
      });
    });
  });

  describe('getLinkErrorMessage', () => {
    it('returns agent not found message when isAgentsTab true and ref present', () => {
      const msg = getLinkErrorMessage(true, 'ref123', undefined);
      expect(msg).toBe('Agent by this link not found');
    });

    it('returns toolset not found message when isAgentsTab false and ref present', () => {
      const msg = getLinkErrorMessage(false, 'ref123', undefined);
      expect(msg).toBe('Toolset by this link not found');
    });

    it('returns undefined if detailsEntity exists', () => {
      const detailsEntity: DetailsEntity = {
        reference: 'ref',
        isSuggested: false,
        type: MarketplaceEntitiesTabs.TOOLSETS,
      };
      const msg = getLinkErrorMessage(true, 'ref', detailsEntity);
      expect(msg).toBeUndefined();
    });

    it('returns undefined if no reference and no detailsEntity', () => {
      const msg = getLinkErrorMessage(false, undefined, undefined);
      expect(msg).toBeUndefined();
    });
  });
});

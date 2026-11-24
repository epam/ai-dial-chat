import type {
  ApplicationValuesDependenciesRequestDto,
  CopyCatalogEntityToOrgUnitDto,
  PublishApi,
  PublishCatalogEntityDto,
  PublishHistoryEntryDto,
  PublishResultDto,
  PublishTargetCheckDto,
  ResourceIdResponseDto,
  ResourceDependenciesResultDto,
  UnpublishAccessDto,
  UnpublishCatalogEntityDto,
  UnpublishResultDto,
  VersionStatusEntryDto,
} from '@epam/ai-dial-chat-api-client';
import type { CatalogPublishEntityType } from './publish';

/** The DIAL publish API surface produced by {@link createPublishApiClient}. */
export interface PublishApiClient {
  /** Submits a publication request for one catalog entity into `folderPath`. */
  publishCatalogEntity: (
    entityType: CatalogPublishEntityType,
    entityId: string,
    body: PublishCatalogEntityDto,
  ) => Promise<PublishResultDto>;
  /**
   * Copies one own catalog entity into an org-unit folder of the public bucket
   * without a publication request; DIAL Core decides the right and its 403 and
   * 409 reject the promise. Resolves to the id of the copy.
   */
  copyCatalogEntityToOrgUnit: (
    entityType: CatalogPublishEntityType,
    entityId: string,
    body: CopyCatalogEntityToOrgUnitDto,
  ) => Promise<ResourceIdResponseDto>;
  /**
   * Submits a removal request for one already-published folder of a catalog
   * entity. The removal takes effect only after an administrator approves it,
   * so callers must report a pending request rather than a completed removal.
   */
  unpublishCatalogEntity: (
    entityType: CatalogPublishEntityType,
    entityId: string,
    body: UnpublishCatalogEntityDto,
  ) => Promise<UnpublishResultDto>;
  /** Reads the folders one catalog entity is already published to. */
  getCatalogPublishHistory: (
    entityType: CatalogPublishEntityType,
    entityId: string,
  ) => Promise<PublishHistoryEntryDto[]>;
  /**
   * Reads the direct dependencies of one catalog entity that are not in the
   * public bucket. Advisory: the backend answers an empty list when it cannot
   * resolve them.
   */
  getCatalogPublishDependencies: (
    entityType: CatalogPublishEntityType,
    entityId: string,
  ) => Promise<ResourceDependenciesResultDto>;
  /**
   * Reads the private dependencies of application property values that are not
   * saved yet, from the values alone; the backend reads no application. Advisory
   * like {@link PublishApiClient.getCatalogPublishDependencies}.
   */
  getApplicationValuesPublishDependencies: (
    body: ApplicationValuesDependenciesRequestDto,
  ) => Promise<ResourceDependenciesResultDto>;
  /** Reads whether the caller may request removal of one catalog entity. */
  getCatalogUnpublishAccess: (
    entityType: CatalogPublishEntityType,
    entityId: string,
  ) => Promise<UnpublishAccessDto>;
  /** Reads the publication status of every saved version of one application or toolset. */
  getCatalogVersionStatuses: (
    entityType: CatalogPublishEntityType,
    entityId: string,
  ) => Promise<VersionStatusEntryDto[]>;
  /**
   * Reads whether the published copy of one catalog entity would land on a path
   * that is already taken, for `folderPath` (plain, `/`-joined) and `version`.
   * Advisory: a copy hidden from the caller, or still pending approval, is not
   * found, and the publish request still answers `409` for it.
   */
  checkPublishTarget: (
    entityType: CatalogPublishEntityType,
    entityId: string,
    folderPath: string,
    version?: string,
  ) => Promise<PublishTargetCheckDto>;
}

/**
 * Wraps the generated `PublishApi` in the positional-argument surface the
 * catalog and conversation publish flows call, so each host app re-exports one
 * client instead of re-declaring the same four wrappers. Mirrors
 * {@link createFilesApiClient}.
 */
export const createPublishApiClient = (
  publishApi: PublishApi,
): PublishApiClient => ({
  publishCatalogEntity: (entityType, entityId, body) =>
    publishApi.publishCatalogEntity({
      entityType,
      entityId,
      publishCatalogEntityDto: body,
    }),
  copyCatalogEntityToOrgUnit: (entityType, entityId, body) =>
    publishApi.copyCatalogEntityToOrgUnit({
      entityType,
      entityId,
      copyCatalogEntityToOrgUnitDto: body,
    }),
  unpublishCatalogEntity: (entityType, entityId, body) =>
    publishApi.unpublishCatalogEntity({
      entityType,
      entityId,
      unpublishCatalogEntityDto: body,
    }),
  getCatalogPublishHistory: (entityType, entityId) =>
    publishApi.getCatalogPublishHistory({ entityType, entityId }),
  getCatalogPublishDependencies: (entityType, entityId) =>
    publishApi.getCatalogPublishDependencies({ entityType, entityId }),
  getApplicationValuesPublishDependencies: (body) =>
    publishApi.getApplicationValuesPublishDependencies({
      applicationValuesDependenciesRequestDto: body,
    }),
  getCatalogUnpublishAccess: (entityType, entityId) =>
    publishApi.getCatalogUnpublishAccess({ entityType, entityId }),
  getCatalogVersionStatuses: (entityType, entityId) =>
    publishApi.getCatalogVersionStatuses({ entityType, entityId }),
  checkPublishTarget: (entityType, entityId, folderPath, version) =>
    publishApi.getCatalogPublishTarget({
      entityType,
      entityId,
      folderPath,
      version,
    }),
});

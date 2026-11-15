import { Injectable, Logger } from '@nestjs/common';
import { CatalogEntityType } from '../dto/catalog-entity-params.dto';
import {
  ResourceDependenciesResultDto,
  ResourceDependencyDto,
} from '../dto/resource-dependency.dto';
import { ApplicationDependencyResolver } from './application-dependency.resolver';
import type { DependencyResolver } from './dependency-resolver';

/**
 * Lists the direct dependencies of a catalog entity that are not in the public
 * bucket. Only an application references other resources; every other kind
 * resolves to an empty list without a DIAL Core call, because its DIAL Core
 * model carries no such reference. Resolution is best-effort: the list is
 * advisory, so a failure yields an empty list instead of an error.
 */
@Injectable()
export class PublishDependenciesService {
  private readonly logger = new Logger(PublishDependenciesService.name);

  private readonly resolvers: Partial<
    Record<CatalogEntityType, DependencyResolver>
  >;

  constructor(applicationResolver: ApplicationDependencyResolver) {
    this.resolvers = {
      [CatalogEntityType.Application]: applicationResolver,
    };
  }

  /**
   * @param accessToken - caller's bearer token
   * @param userSub - caller's session subject, used to scope cached schemas
   * @param entityType - catalog entity kind
   * @param entityId - the entity's DIAL Core resource path
   */
  async getDependencies(
    accessToken: string,
    userSub: string,
    entityType: CatalogEntityType,
    entityId: string,
  ): Promise<ResourceDependenciesResultDto> {
    const resolver = this.resolvers[entityType];
    if (resolver == null) return { dependencies: [] };

    let dependencies: ResourceDependencyDto[] = [];
    try {
      dependencies = await resolver.resolve({ accessToken, userSub }, entityId);
    } catch (err) {
      this.logger.warn(
        `Could not resolve the publish dependencies of ${entityType} "${entityId}": ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
    }
    return { dependencies };
  }
}

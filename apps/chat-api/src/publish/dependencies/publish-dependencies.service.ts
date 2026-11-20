import { Injectable, Logger } from '@nestjs/common';
import { CatalogEntityType } from '../dto/catalog-entity-params.dto';
import {
  ResourceDependenciesResultDto,
  ResourceDependencyDto,
} from '../dto/resource-dependency.dto';
import { ApplicationDependencyResolver } from './application-dependency.resolver';
import type { DependencyResolver } from './dependency-resolver';
import { selectDependenciesSavedWithApplication } from './publish-dependency.util';

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

  constructor(
    private readonly applicationResolver: ApplicationDependencyResolver,
  ) {
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
    try {
      return await this.getDependenciesStrict(
        accessToken,
        userSub,
        entityType,
        entityId,
      );
    } catch (err) {
      this.logger.warn(
        `Could not resolve the publish dependencies of ${entityType} "${entityId}": ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
      return { dependencies: [] };
    }
  }

  /**
   * Like {@link getDependencies}, but a resolver failure reaches the caller
   * instead of becoming an empty list. For a caller that must not go on with a
   * list it could not read, such as a direct write into an org unit.
   * @param accessToken - caller's bearer token
   * @param userSub - caller's session subject, used to scope cached schemas
   * @param entityType - catalog entity kind
   * @param entityId - the entity's DIAL Core resource path
   * @throws {Error} Whatever the resolver throws when the dependencies cannot be read
   */
  async getDependenciesStrict(
    accessToken: string,
    userSub: string,
    entityType: CatalogEntityType,
    entityId: string,
  ): Promise<ResourceDependenciesResultDto> {
    const resolver = this.resolvers[entityType];
    if (resolver == null) return { dependencies: [] };
    const dependencies = await resolver.resolve(
      { accessToken, userSub },
      entityId,
    );
    return { dependencies };
  }

  /**
   * Lists the private dependencies of an application that is not saved yet,
   * from the values of its form, that travel with the application when it is
   * written into an org unit: the caller's own, and files. Best-effort like
   * {@link getDependencies}.
   * @param accessToken - caller's bearer token
   * @param userSub - caller's session subject, used to scope cached schemas
   * @param userBucket - caller's own bucket, empty while it is not resolved
   * @param schemaId - the application type schema the values belong to
   * @param properties - the application property values
   */
  async getApplicationValueDependencies(
    accessToken: string,
    userSub: string,
    userBucket: string,
    schemaId: string,
    properties: Record<string, unknown>,
  ): Promise<ResourceDependenciesResultDto> {
    let dependencies: ResourceDependencyDto[] = [];
    try {
      dependencies = await this.applicationResolver.resolveFromValues(
        { accessToken, userSub },
        schemaId,
        properties,
      );
    } catch (err) {
      this.logger.warn(
        `Could not resolve the publish dependencies of application values for schema "${schemaId}": ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
    }
    return {
      dependencies: selectDependenciesSavedWithApplication(
        dependencies,
        userBucket,
      ),
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ApplicationSchemasService } from '../application-schemas/application-schemas.service';
import { ApplicationsService } from '../applications/applications.service';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { parseDialApplicationResource } from '../common/utils/dial-application-resource';
import {
  DialResourceType,
  resourceExists,
} from '../common/utils/dial-resource-transfer';
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import { PUBLIC_BUCKET } from '../constants/dial.constants';
import { DialClientService } from '../dial/dial-client.service';
import {
  ApplicationPublishCopyService,
  type ApplicationPublishCopy,
} from './application-publish-copy.service';
import { PublishDependenciesService } from './dependencies/publish-dependencies.service';
import { replaceSchemaResources } from './dependencies/schema-resource-collector.util';
import { CatalogEntityType } from './dto/catalog-entity-params.dto';
import {
  ResourceDependencyType,
  type ResourceDependencyDto,
} from './dto/resource-dependency.dto';
import { getPublishedDependencyTargetUrl } from './publish-target.util';

/** One `ADD` resource of the publication, for a dependency that still has to be published. */
export interface DependencyPublicationResource {
  action: 'ADD';
  sourceUrl: string;
  targetUrl: string;
}

/** What `PublishService` needs to publish an application together with its dependencies. */
export interface PreparedApplicationPublication {
  /** The temporary copy, which the publication names as the application's `sourceUrl`; delete it when the call returns. */
  copy: ApplicationPublishCopy;
  /** One `ADD` per dependency whose target does not exist yet. */
  dependencyResources: DependencyPublicationResource[];
  /** The dependencies published with this request, for cache invalidation. */
  publishedDependencies: ResourceDependencyDto[];
  reusedCount: number;
}

const DIAL_TYPE_BY_DEPENDENCY: Partial<
  Record<ResourceDependencyType, DialResourceType>
> = {
  [ResourceDependencyType.Application]: DialResourceType.Applications,
  [ResourceDependencyType.Toolset]: DialResourceType.Toolsets,
  [ResourceDependencyType.Prompt]: DialResourceType.Prompts,
  [ResourceDependencyType.Skill]: DialResourceType.Skills,
};

/** The catalog entity kind of a dependency, for the publish-history cache key. */
export const CATALOG_TYPE_BY_DEPENDENCY: Partial<
  Record<ResourceDependencyType, CatalogEntityType>
> = {
  [ResourceDependencyType.Application]: CatalogEntityType.Application,
  [ResourceDependencyType.Toolset]: CatalogEntityType.Toolset,
  [ResourceDependencyType.Prompt]: CatalogEntityType.Prompt,
  [ResourceDependencyType.Skill]: CatalogEntityType.Skill,
};

/**
 * The dependencies that are added to the request and rewritten. A `file` is
 * left out on purpose: DIAL Core copies and relinks every FILE-typed value a
 * schema marks when it copies the application, so adding it here as well would
 * publish it twice. A dependency in another user's bucket is left as it is, as
 * the files of a published conversation are: publishing it would publish a
 * resource its owner never chose to share.
 * @param dependencies - the application's private dependencies
 * @param ownBucket - the caller's own bucket
 */
export const selectPublishableDependencies = (
  dependencies: ResourceDependencyDto[],
  ownBucket: string,
): ResourceDependencyDto[] =>
  dependencies.filter(
    (dependency) =>
      dependency.type !== ResourceDependencyType.File &&
      dependency.id.split('/')[1] === ownBucket,
  );

/**
 * Prepares the publication of an application together with its first-level
 * private dependencies: resolves them, computes where each will be
 * published, and makes the temporary copy of the application whose references
 * point at those paths. The author's own application is never written.
 */
@Injectable()
export class ApplicationPublishPreparationService {
  private readonly logger = new Logger(
    ApplicationPublishPreparationService.name,
  );

  constructor(
    private readonly dialClient: DialClientService,
    private readonly dependenciesService: PublishDependenciesService,
    private readonly copyService: ApplicationPublishCopyService,
    private readonly applicationsService: ApplicationsService,
    private readonly schemasService: ApplicationSchemasService,
  ) {}

  /**
   * @param userSub - caller's session subject
   * @param accessToken - caller's bearer token
   * @param bucket - caller's own bucket
   * @param entityId - the application's resource path
   * @param folderPath - plain publish target folder
   * @param targetResourceName - last segment of the application's published `targetUrl`
   * @returns `undefined` when the application has nothing to publish with it or is not the caller's own, so the caller sends the unchanged request
   * @throws {ApplicationBeingPublishedException} When the same application is already being published
   * @throws {Error} When anything else in the preparation fails; the caller publishes the application without its dependencies
   */
  async prepare(
    userSub: string,
    accessToken: string,
    bucket: string,
    entityId: string,
    folderPath: string,
    targetResourceName: string,
  ): Promise<PreparedApplicationPublication | undefined> {
    const resource = parseDialApplicationResource(
      encodeDialResourcePath(entityId),
    );
    if (resource != null && resource.bucket !== bucket) return undefined;

    const { dependencies: found } =
      await this.dependenciesService.getDependencies(
        accessToken,
        userSub,
        CatalogEntityType.Application,
        entityId,
      );
    const dependencies = selectPublishableDependencies(found, bucket);
    if (dependencies.length === 0) return undefined;

    const headers = getBearerAuthHeaders(accessToken);
    const targets = new Map<string, string>();
    const planned = dependencies.map((dependency) => {
      const targetUrl = getPublishedDependencyTargetUrl(
        folderPath,
        targetResourceName,
        dependency.id,
      );
      targets.set(dependency.id, targetUrl);
      return { dependency, targetUrl };
    });
    const existing = await Promise.all(
      planned.map(({ dependency, targetUrl }) =>
        this.targetExists(headers, dependency, targetUrl),
      ),
    );
    const dependencyResources: DependencyPublicationResource[] = [];
    const publishedDependencies: ResourceDependencyDto[] = [];
    planned.forEach(({ dependency, targetUrl }, index) => {
      if (existing[index]) return;
      publishedDependencies.push(dependency);
      dependencyResources.push({
        action: 'ADD',
        sourceUrl: encodeDialResourcePath(dependency.id),
        targetUrl,
      });
    });

    const original = await this.applicationsService.resolveOwnApplication(
      headers,
      entityId,
      bucket,
    );
    const copy = await this.copyService.create(
      userSub,
      accessToken,
      original,
      async (body) => {
        const schemaId = body.application_type_schema_id;
        if (!schemaId || body.application_properties == null) return body;
        const schema = await this.schemasService.getApplicationSchema(
          userSub,
          accessToken,
          schemaId,
        );
        return {
          ...body,
          application_properties: replaceSchemaResources(
            schema,
            body.application_properties,
            targets,
          ) as typeof body.application_properties,
        };
      },
    );
    return {
      copy,
      dependencyResources,
      publishedDependencies,
      reusedCount: dependencies.length - publishedDependencies.length,
    };
  }

  /**
   * Deletes the temporary copy a prepared publication made.
   * @param userSub - caller's session subject
   * @param accessToken - caller's bearer token
   * @param prepared - what {@link prepare} returned
   */
  cleanup(
    userSub: string,
    accessToken: string,
    prepared: PreparedApplicationPublication,
  ): Promise<void> {
    return this.copyService.delete(userSub, accessToken, prepared.copy);
  }

  /**
   * Whether the dependency's published target already exists.
   * @param headers - bearer headers for DIAL Core
   * @param dependency - the dependency being published
   * @param targetUrl - where it would be published
   * @throws {Error} When Core's answer is neither found nor not found
   */
  private async targetExists(
    headers: ReturnType<typeof getBearerAuthHeaders>,
    dependency: ResourceDependencyDto,
    targetUrl: string,
  ): Promise<boolean> {
    const type = DIAL_TYPE_BY_DEPENDENCY[dependency.type];
    if (type == null) return false;
    const [, , ...path] = targetUrl.split('/');
    const exists = await resourceExists(
      this.dialClient.client,
      type,
      { bucket: PUBLIC_BUCKET, path: path.join('/') },
      headers,
    );
    if (exists) {
      this.logger.debug(
        `Reusing the published dependency "${targetUrl}" instead of publishing it again`,
      );
    }
    return exists;
  }
}

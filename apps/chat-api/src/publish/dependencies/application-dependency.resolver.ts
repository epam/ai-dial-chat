import { Injectable } from '@nestjs/common';
import { ApplicationSchemasService } from '../../application-schemas/application-schemas.service';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { parseDialApplicationResource } from '../../common/utils/dial-application-resource';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { DialClientService } from '../../dial/dial-client.service';
import type { ResourceDependencyDto } from '../dto/resource-dependency.dto';
import type {
  DependencyResolver,
  DependencyResolverContext,
} from './dependency-resolver';
import { collectDependencies } from './publish-dependency.util';
import { collectSchemaResources } from './schema-resource-collector.util';

/**
 * Resolves what an application refers to by reading the application's own
 * schema: every value on a `dial:resource` property is a reference, the same
 * marker DIAL Core uses. An application without a schema (a plain custom one)
 * has none.
 */
@Injectable()
export class ApplicationDependencyResolver implements DependencyResolver {
  constructor(
    private readonly dialClient: DialClientService,
    private readonly applicationSchemasService: ApplicationSchemasService,
  ) {}

  /**
   * @param context - the caller's credentials
   * @param entityId - `applications/{bucket}/{name}`
   * @throws {Error} When the application cannot be read or its schema cannot be fetched
   */
  async resolve(
    { accessToken, userSub }: DependencyResolverContext,
    entityId: string,
  ): Promise<ResourceDependencyDto[]> {
    const resource = parseDialApplicationResource(
      encodeDialResourcePath(entityId),
    );
    if (resource == null) return [];

    const result = await this.dialClient.client.getCustomApplication(
      resource.bucket,
      resource.path,
      { headers: getBearerAuthHeaders(accessToken) },
    );
    if (result.error != null || result.data == null) {
      throw new Error(
        `application read failed with status ${result.response?.status}`,
      );
    }

    const {
      application_type_schema_id: schemaId,
      application_properties: properties,
    } = result.data;
    if (!schemaId || properties == null) return [];

    const schema = await this.applicationSchemasService.getApplicationSchema(
      userSub,
      accessToken,
      schemaId,
    );
    return collectDependencies(collectSchemaResources(schema, properties));
  }
}

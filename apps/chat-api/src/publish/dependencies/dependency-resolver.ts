import type { ResourceDependencyDto } from '../dto/resource-dependency.dto';

/** What a resolver needs to read an entity on the caller's behalf. */
export interface DependencyResolverContext {
  /** Caller's bearer token. */
  accessToken: string;
  /** Caller's session subject, used to scope cached schemas. */
  userSub: string;
}

/** Reads the direct references of one kind of catalog entity. */
export interface DependencyResolver {
  /**
   * @param context - the caller's credentials
   * @param entityId - the entity's DIAL Core resource path
   * @returns the entity's dependencies that are not in the public bucket
   */
  resolve: (
    context: DependencyResolverContext,
    entityId: string,
  ) => Promise<ResourceDependencyDto[]>;
}

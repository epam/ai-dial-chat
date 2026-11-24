/**
 * Rights a resource dependency may request. DIAL Core also knows `SHARE`, but
 * rejects it on a dependency, so it is deliberately absent.
 */
export enum ResourceDependencyAccess {
  Read = 'READ',
  Write = 'WRITE',
}

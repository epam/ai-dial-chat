export enum ApplicationErrorCode {
  /** A resource the application depends on, such as a context file, is no longer available. */
  DependentResourceMissing = 'applicationDependentResourceMissing',
  /** DIAL Core only lets an administrator change the resource dependencies of an application. */
  ResourceDependenciesNotAllowed = 'applicationResourceDependenciesNotAllowed',
}

import {
  OrgUnitNamespace,
  type CatalogEntityType,
} from '@epam/ai-dial-chat-shared';
import type { PublishDependencyType } from '@epam/ai-dial-publish-panel';
import {
  toPublishEntityType,
  type CatalogPublishEntityType,
} from '../catalog/publish';
import { SaveDestinationRoot } from '../catalog/save-destination-root';
import { OrgUnitsStatus } from './types';
import type { OrgUnitRightCheck } from './useOrgUnits/useOrgUnits';

const NAMESPACE_BY_ENTITY_TYPE: Record<
  CatalogPublishEntityType,
  OrgUnitNamespace | undefined
> = {
  model: undefined,
  toolset: OrgUnitNamespace.Toolsets,
  application: OrgUnitNamespace.Applications,
  prompt: OrgUnitNamespace.Prompts,
  skill: OrgUnitNamespace.Skills,
  project: OrgUnitNamespace.Projects,
};

/**
 * The Core namespace an org unit grants rights on for a publishable resource
 * type. Quick App, schema-form and custom applications are all `application`.
 * A model is never saved or published by a user, so it has no namespace. A
 * conversation has no catalog entity type; its containers pass
 * `OrgUnitNamespace.Conversations` directly.
 * @param entityType - the publish API's entity type
 */
export const getOrgUnitNamespace = (
  entityType: CatalogPublishEntityType,
): OrgUnitNamespace | undefined => NAMESPACE_BY_ENTITY_TYPE[entityType];

/** Which panel the guards are built for; picks the right they check. */
export enum OrgUnitFolderGuardPurpose {
  /** A save destination is usable outside every unit, and inside one only with `write` on its owner. */
  Save = 'save',
  /** A publication request needs `read` on the owning unit. */
  Publish = 'publish',
}

/** Inputs of {@link buildFolderGuards}. */
export interface BuildFolderGuardsParams {
  purpose: OrgUnitFolderGuardPurpose;
  /** Whether the `orgUnitsEnabled` feature flag is on. */
  isEnabled: boolean;
  /** Load status from `useOrgUnits`. */
  status: OrgUnitsStatus;
  /** Namespace of the resource type, from {@link getOrgUnitNamespace}; `undefined` turns the guards off. */
  namespace: OrgUnitNamespace | undefined;
  canSaveAt: OrgUnitRightCheck;
  canPublishAt: OrgUnitRightCheck;
  /** Strict check from `useOrgUnits`; omit it when the panel has no direct save. */
  canSaveDirectlyAt?: OrgUnitRightCheck;
  /** The host's translated reason shown for a disabled folder; without it `getDisabledReason` is `undefined`. */
  getReason?: (folderPath: string[]) => string;
}

/** Guards a panel passes to its folder tree; both are `undefined` while the rule does not apply. */
export interface FolderGuards {
  /** Whether a destination is usable for the panel's purpose (Save: `canSaveAt`, Publish: `canPublishAt`); a host passes it to `usePublishFolders` as `canPublishTo`, where it replaces the `Production` placeholder. Only the Organization root is matched against units: any other `root` is always usable, and an omitted `root` means Organization (the publish panels' only tree). */
  isDestinationUsable:
    ((folderPath: string[], root?: SaveDestinationRoot) => boolean) | undefined;
  /** The reason a destination is disabled, or `undefined` when it is usable; `root` follows the same rule as in `isDestinationUsable`. */
  getDisabledReason:
    | ((folderPath: string[], root?: SaveDestinationRoot) => string | undefined)
    | undefined;
  /** Whether a save may write straight into the destination (inside an org unit that grants `write`); like `isDestinationUsable`, only the Organization root (or an omitted root) can be a unit, so a Personal folder never direct-writes. `undefined` while the rule does not apply or no check was given. */
  canSaveDirectlyTo:
    ((folderPath: string[], root?: SaveDestinationRoot) => boolean) | undefined;
}

/**
 * Builds the folder guards from the org-unit answers. They exist only with the
 * feature flag on, status `Ready` and a namespace; otherwise both are
 * `undefined`, so a panel keeps today's behaviour (the `Production`
 * placeholder, no disabled rows).
 * @param params - flag, status, namespace, the hook's right checks and the reason text callback
 */
export const buildFolderGuards = ({
  purpose,
  isEnabled,
  status,
  namespace,
  canSaveAt,
  canPublishAt,
  canSaveDirectlyAt,
  getReason,
}: BuildFolderGuardsParams): FolderGuards => {
  if (!isEnabled || status !== OrgUnitsStatus.Ready || namespace == null) {
    return {
      isDestinationUsable: undefined,
      getDisabledReason: undefined,
      canSaveDirectlyTo: undefined,
    };
  }
  const check =
    purpose === OrgUnitFolderGuardPurpose.Save ? canSaveAt : canPublishAt;
  const isDestinationUsable = (
    folderPath: string[],
    root: SaveDestinationRoot = SaveDestinationRoot.Organization,
  ): boolean =>
    root !== SaveDestinationRoot.Organization ||
    check(folderPath.join('/'), namespace);
  return {
    isDestinationUsable,
    canSaveDirectlyTo:
      canSaveDirectlyAt &&
      ((folderPath: string[], root = SaveDestinationRoot.Organization) =>
        root === SaveDestinationRoot.Organization &&
        canSaveDirectlyAt(folderPath.join('/'), namespace)),
    getDisabledReason:
      getReason &&
      ((folderPath, root) =>
        isDestinationUsable(folderPath, root)
          ? undefined
          : getReason(folderPath)),
  };
};

/**
 * Adapts a guard's `getDisabledReason(folderPath)` to the publish panels'
 * `getDisabledReason(destination)`: a publish tree has one root, so only the
 * path is judged.
 * @param getDisabledReason - the guard's callback, or `undefined` while the rule does not apply
 */
export const toPublishDisabledReason = (
  getDisabledReason: ((folderPath: string[]) => string | undefined) | undefined,
): ((destination: { path: string[] }) => string | undefined) | undefined =>
  getDisabledReason && ((destination) => getDisabledReason(destination.path));

/* Keyed by the enum's values, which are the publish-dependencies API's `type` values: the enum is only a type here so this module, which the lean `./utils` entry carries, takes no runtime dependency on the optional `@epam/ai-dial-publish-panel` peer. */
const NAMESPACE_BY_DEPENDENCY_TYPE: Record<
  `${PublishDependencyType}`,
  OrgUnitNamespace | undefined
> = {
  application: OrgUnitNamespace.Applications,
  toolset: OrgUnitNamespace.Toolsets,
  prompt: OrgUnitNamespace.Prompts,
  skill: OrgUnitNamespace.Skills,
  file: undefined,
};

/**
 * The kind of dependency whose resources live in `namespace`, or `undefined` for a namespace no dependency has.
 * @param namespace - org-unit namespace
 */
export const getDependencyTypeOfNamespace = (
  namespace: OrgUnitNamespace,
): PublishDependencyType | undefined =>
  Object.entries(NAMESPACE_BY_DEPENDENCY_TYPE).find(
    ([, candidate]) => candidate === namespace,
  )?.[0] as unknown as PublishDependencyType | undefined;

/**
 * The org-unit namespaces a direct write must hold `write` on to copy the given
 * dependencies, each once. A `file` has none: the files a schema marks travel
 * with the application.
 * @param dependencies - the dependencies the panel lists
 */
export const getDependencyOrgUnitNamespaces = (
  dependencies: readonly { type: PublishDependencyType }[],
): OrgUnitNamespace[] => {
  const namespaces = new Set<OrgUnitNamespace>();
  for (const { type } of dependencies) {
    const namespace = NAMESPACE_BY_DEPENDENCY_TYPE[type];
    if (namespace != null) namespaces.add(namespace);
  }
  return [...namespaces];
};

/** Inputs of {@link getMissingDirectWriteNamespaces}. */
interface MissingDirectWriteNamespacesParams {
  /** Whether the `orgUnitsEnabled` feature flag is on. */
  isEnabled: boolean;
  /** Load status from `useOrgUnits`. */
  status: OrgUnitsStatus;
  /** Strict write check from `useOrgUnits` (`canSaveDirectlyAt`). */
  canSaveDirectlyAt: OrgUnitRightCheck;
}

/**
 * The namespaces, among those asked, the user may not write straight into the
 * org unit that owns the folder. Empty while the rights are not known (flag
 * off or status not `Ready`), so missing data never disables a folder.
 * @param params - flag, status and the hook's strict check
 * @param folderPath - the destination folder inside the Organization root
 * @param namespaces - the namespaces the write needs
 */
export const getMissingDirectWriteNamespaces = (
  { isEnabled, status, canSaveDirectlyAt }: MissingDirectWriteNamespacesParams,
  folderPath: string[],
  namespaces: readonly OrgUnitNamespace[],
): OrgUnitNamespace[] =>
  !isEnabled || status !== OrgUnitsStatus.Ready
    ? []
    : namespaces.filter(
        (namespace) => !canSaveDirectlyAt(folderPath.join('/'), namespace),
      );

/** Outcome of {@link getPublishDirectAvailability}. */
export interface PublishDirectAvailability {
  /** Whether the publish may write directly: the entity check holds and no dependency namespace is missing. */
  isDirect: boolean;
  /** Dependency namespaces the user may not write in the owning unit; empty unless the entity check holds. */
  missingNamespaces: OrgUnitNamespace[];
  /** The dependency kinds of `missingNamespaces`, for the host to name; same order, same emptiness. */
  missingTypes: PublishDependencyType[];
}

/** Checks {@link getPublishDirectAvailability} reads, both from `useOrgUnits`. */
export interface PublishDirectChecks {
  /** The entity's own direct-publish check. */
  canPublishDirectlyAt: OrgUnitRightCheck;
  /** Strict write check, applied to each dependency namespace. */
  canSaveDirectlyAt: OrgUnitRightCheck;
}

/**
 * Whether a publish into the folder writes directly and which dependency
 * namespaces block it. A user who may not publish the entity directly gets no
 * missing list, since a request is filed anyway; a dependency type with no
 * namespace (a file) never blocks.
 * @param folderPath - the destination folder inside the Organization root
 * @param namespace - the entity's org-unit namespace
 * @param dependencyTypes - the types of the private dependencies the panel lists
 * @param checks - the hook's direct-publish and strict write checks
 */
export const getPublishDirectAvailability = (
  folderPath: string[],
  namespace: OrgUnitNamespace,
  dependencyTypes: readonly PublishDependencyType[],
  { canPublishDirectlyAt, canSaveDirectlyAt }: PublishDirectChecks,
): PublishDirectAvailability => {
  const path = folderPath.join('/');
  if (!canPublishDirectlyAt(path, namespace)) {
    return { isDirect: false, missingNamespaces: [], missingTypes: [] };
  }
  const missingNamespaces = getDependencyOrgUnitNamespaces(
    dependencyTypes.map((type) => ({ type })),
  ).filter((dependency) => !canSaveDirectlyAt(path, dependency));
  return {
    isDirect: missingNamespaces.length === 0,
    missingNamespaces,
    missingTypes: missingNamespaces.flatMap((missing) => {
      const type = getDependencyTypeOfNamespace(missing);
      return type == null ? [] : [type];
    }),
  };
};

/**
 * {@link getPublishDirectAvailability} for a catalog item type: the entity's
 * namespace comes from its publish entity type, and a type that cannot be
 * published (or has no namespace) is never direct.
 * @param itemType - the catalog entity type of the item being published
 * @param folderPath - the destination folder inside the Organization root
 * @param dependencyTypes - the types of the private dependencies the panel lists
 * @param checks - the hook's direct-publish and strict write checks
 */
export const getCatalogPublishDirectAvailability = (
  itemType: CatalogEntityType,
  folderPath: string[],
  dependencyTypes: readonly PublishDependencyType[],
  checks: PublishDirectChecks,
): PublishDirectAvailability => {
  const entityType = toPublishEntityType(itemType);
  const namespace =
    entityType == null ? undefined : getOrgUnitNamespace(entityType);
  if (namespace == null) {
    return { isDirect: false, missingNamespaces: [], missingTypes: [] };
  }
  return getPublishDirectAvailability(
    folderPath,
    namespace,
    dependencyTypes,
    checks,
  );
};

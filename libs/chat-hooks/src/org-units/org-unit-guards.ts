import { OrgUnitNamespace } from '@epam/ai-dial-chat-shared';
import type { CatalogPublishEntityType } from '../catalog/publish';
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
  /** Whether a destination accepts the action; replaces the `Production` placeholder in `usePublishFolders`. Only the Organization root is matched against units: any other `root` is always usable, and an omitted `root` means Organization (the publish panels' only tree). */
  canPublishTo:
    ((folderPath: string[], root?: SaveDestinationRoot) => boolean) | undefined;
  /** The reason a destination is disabled, or `undefined` when it is usable; `root` follows the same rule as in `canPublishTo`. */
  getDisabledReason:
    | ((folderPath: string[], root?: SaveDestinationRoot) => string | undefined)
    | undefined;
  /** Whether a save may write straight into the destination (inside an org unit that grants `write`); like `canPublishTo`, only the Organization root (or an omitted root) can be a unit, so a Personal folder never direct-writes. `undefined` while the rule does not apply or no check was given. */
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
      canPublishTo: undefined,
      getDisabledReason: undefined,
      canSaveDirectlyTo: undefined,
    };
  }
  const check =
    purpose === OrgUnitFolderGuardPurpose.Save ? canSaveAt : canPublishAt;
  const canPublishTo = (
    folderPath: string[],
    root: SaveDestinationRoot = SaveDestinationRoot.Organization,
  ): boolean =>
    root !== SaveDestinationRoot.Organization ||
    check(folderPath.join('/'), namespace);
  return {
    canPublishTo,
    canSaveDirectlyTo:
      canSaveDirectlyAt &&
      ((folderPath: string[], root = SaveDestinationRoot.Organization) =>
        root === SaveDestinationRoot.Organization &&
        canSaveDirectlyAt(folderPath.join('/'), namespace)),
    getDisabledReason:
      getReason &&
      ((folderPath, root) =>
        canPublishTo(folderPath, root) ? undefined : getReason(folderPath)),
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

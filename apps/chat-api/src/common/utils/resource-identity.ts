import { ConflictException } from '@nestjs/common';
import { HIDDEN_FILE } from '../../constants/dial.constants';
import type { LocalizedText } from '../types/localized-text';
import { ResourceNameConflictCode } from '../types/resource-name-conflict-code';
import { safeDecodeURIComponent } from './uri';

/** Version DIAL Core resources are written with when the caller sends none. */
export const DEFAULT_RESOURCE_VERSION = '1.0.0';

/** Kind of DIAL Core resource an identity entry was read from. */
export enum ResourceIdentityKind {
  /** An application resource; shown as an agent and, with `mcp`, as a toolset. */
  Application = 'application',
  /** A toolset resource. */
  Toolset = 'toolset',
}

/** Catalog tab an entity competes in; two entities clash only inside one tab. */
export enum ResourceIdentityTab {
  Agents = 'agents',
  Toolsets = 'toolsets',
}

enum InterfaceName {
  Chat = 'chat',
  CustomUi = 'custom_ui',
  Mcp = 'mcp',
}

/** One own deployment or toolset, flattened from a list entry. */
export interface ResourceIdentityEntry {
  id: string;
  kind: ResourceIdentityKind;
  displayName?: LocalizedText;
  displayVersion?: string;
  interfaces?: readonly string[];
  isMy?: boolean;
}

/** The identity a write is about to give an entity. */
export interface ResourceIdentityCandidate {
  /** Plain (not encoded) folder path; empty is the bucket root. */
  folder: string;
  name: string;
  version?: string;
}

/**
 * The catalog tabs an entity belongs to. Mirrors the deployment
 * classification the catalog uses (`resolveDeploymentCatalogTabs` in
 * `libs/chat-hooks`, table in the `resource-name-uniqueness` spec) assuming the
 * Toolsets tab is enabled, because the backend cannot see that option. An
 * application with no recognised interface is an agent.
 * @param kind - resource kind the entry was read from
 * @param interfaces - DIAL Core interfaces of an application; ignored for a toolset
 */
export const getResourceIdentityTabs = (
  kind: ResourceIdentityKind,
  interfaces?: readonly string[],
): ResourceIdentityTab[] => {
  if (kind === ResourceIdentityKind.Toolset) {
    return [ResourceIdentityTab.Toolsets];
  }
  const hasMcp = interfaces?.includes(InterfaceName.Mcp) ?? false;
  const isAgentInterface =
    (interfaces?.includes(InterfaceName.Chat) ?? false) ||
    (interfaces?.includes(InterfaceName.CustomUi) ?? false);
  if (!hasMcp) return [ResourceIdentityTab.Agents];
  if (isAgentInterface) {
    return [ResourceIdentityTab.Agents, ResourceIdentityTab.Toolsets];
  }
  return [ResourceIdentityTab.Toolsets];
};

/**
 * The name a stored entity is shown under: a plain string as it is, a locale
 * map by its `en` entry and otherwise its first entry. A map carries no marker
 * of its primary locale, so this deterministic rule stands in for it.
 * @param displayName - stored display name, if any
 */
export const resolveDisplayedName = (displayName?: LocalizedText): string => {
  if (displayName == null) return '';
  if (typeof displayName === 'string') return displayName.trim();
  const values = Object.values(displayName);
  return (displayName['en'] ?? values[0] ?? '').trim();
};

/**
 * The plain folder path of a resource id: the segments between the bucket and
 * the last segment, decoded. The bucket root is the empty string.
 * @param id - resource id such as `applications/{bucket}/{folder…}/{leaf}`
 */
export const getResourceIdentityFolder = (id: string): string => {
  const segments = id.split('/');
  return segments.slice(2, -1).map(safeDecodeURIComponent).join('/');
};

/**
 * Finds an own entity that already holds the candidate's identity: same
 * folder, same trimmed displayed name, same displayed version, and a shared
 * catalog tab. The entity being written is skipped, so a save never clashes
 * with itself.
 * @param params.candidate - identity the write is about to apply
 * @param params.tabs - tabs the written entity belongs to
 * @param params.entries - every deployment and toolset the caller can see
 * @param params.selfId - id of the entity being updated, if any
 */
export const findDuplicateIdentity = ({
  candidate,
  tabs,
  entries,
  selfId,
}: {
  candidate: ResourceIdentityCandidate;
  tabs: readonly ResourceIdentityTab[];
  entries: readonly ResourceIdentityEntry[];
  selfId?: string;
}): ResourceIdentityEntry | undefined => {
  const name = candidate.name.trim();
  const version = candidate.version ?? DEFAULT_RESOURCE_VERSION;
  return entries.find((entry) => {
    if (entry.isMy !== true || entry.id === selfId) return false;
    if (entry.id.includes(HIDDEN_FILE)) return false;
    if (getResourceIdentityFolder(entry.id) !== candidate.folder) return false;
    if (resolveDisplayedName(entry.displayName) !== name) return false;
    if ((entry.displayVersion ?? DEFAULT_RESOURCE_VERSION) !== version) {
      return false;
    }
    return getResourceIdentityTabs(entry.kind, entry.interfaces).some((tab) =>
      tabs.includes(tab),
    );
  });
};

/**
 * The `409` for a duplicate identity, shaped like the project create errors
 * (`statusCode`, `message`, `error`, `code`).
 * @param conflict - the entity that already holds the identity
 */
export const buildResourceNameConflict = (
  conflict: ResourceIdentityEntry,
): ConflictException => {
  const isToolset = conflict.kind === ResourceIdentityKind.Toolset;
  return new ConflictException({
    statusCode: 409,
    message: `${isToolset ? 'A toolset' : 'An agent'} with this name and version already exists in this folder`,
    error: 'Conflict',
    code: isToolset
      ? ResourceNameConflictCode.NameTakenToolset
      : ResourceNameConflictCode.NameTakenAgent,
  });
};

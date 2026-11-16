import type {
  ManagedResolutionView,
  ManagedSnapshot,
} from './managed-runtime.types';

/** A managed feature state as the `chat-ui` schema defines it. */
export interface ManagedFeatureState {
  readonly enabled: boolean;
  readonly availability?: {
    readonly startsAt?: string;
    readonly endsAt?: string;
  };
  readonly targeting?: { readonly roles: readonly string[] };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const section = (
  snapshot: ManagedSnapshot,
  name: 'config' | 'features',
): Record<string, unknown> | undefined => {
  const value = snapshot.payload[name];
  return isRecord(value) ? value : undefined;
};

/** The snapshot's value for a config key; `undefined` when it supplies none. */
export const readManagedConfigValue = (
  snapshot: ManagedSnapshot,
  key: string,
): unknown => section(snapshot, 'config')?.[key];

/** The snapshot's feature state for a key; `undefined` when it has none. */
export const readManagedFeatureState = (
  snapshot: ManagedSnapshot,
  key: string,
): ManagedFeatureState | undefined => {
  const state = section(snapshot, 'features')?.[key];
  /* Acceptance already validated the shape against the schema. */
  return isRecord(state) && typeof state['enabled'] === 'boolean'
    ? (state as unknown as ManagedFeatureState)
    : undefined;
};

/**
 * Whether `now` lies in the window: at or after `startsAt` (inclusive) and
 * before `endsAt` (exclusive). No window means no time restriction.
 */
export const isWindowActive = (
  availability: ManagedFeatureState['availability'],
  now: number,
): boolean => {
  if (!availability) return true;
  const { startsAt, endsAt } = availability;
  if (startsAt != null && now < Date.parse(startsAt)) return false;
  if (endsAt != null && now >= Date.parse(endsAt)) return false;
  return true;
};

/**
 * Whether the caller's verified session roles match the targeting. No
 * targeting means no role restriction; a caller without roles (an
 * anonymous one) never matches a role list.
 */
export const matchesTargeting = (
  targeting: ManagedFeatureState['targeting'],
  roles: readonly string[] | undefined,
): boolean => {
  if (!targeting) return true;
  const callerRoles = roles ?? [];
  return targeting.roles.some((role) => callerRoles.includes(role));
};

/**
 * The earliest window boundary after `now` among `featureKeys` in the
 * snapshot, so a cached result or a browser refresh never outlives it.
 */
export const nextManagedBoundary = (
  snapshot: ManagedSnapshot,
  featureKeys: Iterable<string>,
  now: number,
): number | undefined => {
  let next: number | undefined;
  for (const key of featureKeys) {
    const availability = readManagedFeatureState(snapshot, key)?.availability;
    for (const boundary of [availability?.startsAt, availability?.endsAt]) {
      if (boundary == null) continue;
      const instant = Date.parse(boundary);
      if (instant > now && (next == null || instant < next)) next = instant;
    }
  }
  return next;
};

/** The inputs of one active managed feature's gates. */
export interface ManagedFeatureGateInput {
  readonly key: string;
  readonly view: ManagedResolutionView | undefined;
  /** The selected enabled bit: explicit ENV, then managed, then default. */
  readonly configuredEnabled: unknown;
  readonly capabilityAvailable: boolean;
  readonly roles: readonly string[] | undefined;
}

/**
 * The gates of an active managed feature, all required: the configured bit,
 * a usable snapshot that has a policy for the key, the local capability, the
 * availability window and role targeting. An explicit ENV `true` only sets
 * the configured bit, so it cannot satisfy any other gate; an ENV `false`
 * makes the configured bit `false`. The deployment role gate is applied by
 * the caller after this.
 */
export const isManagedFeatureEnabled = ({
  key,
  view,
  configuredEnabled,
  capabilityAvailable,
  roles,
}: ManagedFeatureGateInput): boolean => {
  if (configuredEnabled !== true || !capabilityAvailable) return false;
  if (!view?.snapshot) return false;
  const state = readManagedFeatureState(view.snapshot, key);
  if (!state) return false;
  return (
    isWindowActive(state.availability, view.now) &&
    matchesTargeting(state.targeting, roles)
  );
};
